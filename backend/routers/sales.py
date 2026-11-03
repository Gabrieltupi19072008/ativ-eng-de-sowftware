"""Vendas do artista, todos os pedidos (admin) e relatórios do painel administrativo."""
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

import config
from database import get_db
from deps import current_user, require_admin
from errors import ApiError
from models import Categoria, Cliente, Estoque, ItemPedido, Pedido, Produto, ProdutoCategoria
from orders_service import expire_orders
from serializers import ORDER_STATUS_OUT, absolute_url, order_view

router = APIRouter(tags=["sales"])

# Pedidos que já viraram dinheiro (o pedido cancelado não conta; o que aguarda pagamento ainda não é venda).
PAID_STATUSES = ("PAGO", "ENVIADO", "ENTREGUE")


@router.get("/sales")
def my_sales(user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    """Obras vendidas (ou reservadas) do artista logado. O administrador vê as de todos os artistas."""
    if user.papel not in ("ARTISTA", "ADMIN"):
        raise ApiError(403, "Acesso restrito a artistas.")
    expire_orders(db)

    query = (
        select(ItemPedido, Pedido, Cliente)
        .join(Pedido, Pedido.id_pedido == ItemPedido.id_pedido)
        .join(Cliente, Cliente.id_cliente == Pedido.id_cliente)
        .join(Produto, Produto.id_produto == ItemPedido.id_produto)
        .options(joinedload(ItemPedido.produto).joinedload(Produto.artista))
        .where(Pedido.status != "CANCELADO")
        .order_by(Pedido.id_pedido.desc(), ItemPedido.id_produto)
    )
    if user.papel == "ARTISTA":
        query = query.where(Produto.id_artista == user.id_cliente)

    sales = []
    for item, order, buyer in db.execute(query).unique():
        sales.append({
            "orderId": str(order.id_pedido),
            "orderNumber": f"NG-{order.id_pedido:06d}",
            "status": ORDER_STATUS_OUT[order.status],
            "createdAt": order.data_pedido.isoformat(),
            "artworkId": str(item.id_produto),
            "title": item.produto.nome,
            "artistName": item.produto.artista.nome,
            "image": absolute_url(item.produto.url_imagem),
            "price": float(item.preco_unitario),
            "buyerName": buyer.nome,
            "buyerCity": buyer.cidade or "",
            "buyerState": buyer.estado or "",
        })
    return sales


@router.get("/admin/orders")
def all_orders(_admin: Cliente = Depends(require_admin), db: Session = Depends(get_db)):
    expire_orders(db)
    orders = list(db.scalars(
        select(Pedido)
        .options(
            selectinload(Pedido.itens).joinedload(ItemPedido.produto).joinedload(Produto.artista),
            joinedload(Pedido.endereco),
            joinedload(Pedido.pagamento),
        )
        .order_by(Pedido.id_pedido.desc())
    ).unique())
    buyers = {c.id_cliente: c for c in db.scalars(select(Cliente).where(Cliente.id_cliente.in_({o.id_cliente for o in orders})))}
    return [{**order_view(o, config.FAKE_PAYMENTS), "buyerName": buyers[o.id_cliente].nome, "buyerEmail": buyers[o.id_cliente].email} for o in orders]


@router.get("/admin/reports")
def reports(_admin: Cliente = Depends(require_admin), db: Session = Depends(get_db)):
    expire_orders(db)

    # Vendas confirmadas: um registro por obra vendida
    rows = db.execute(
        select(ItemPedido.id_produto, ItemPedido.preco_unitario, ItemPedido.quantidade, Produto.id_artista, Cliente.nome)
        .join(Pedido, Pedido.id_pedido == ItemPedido.id_pedido)
        .join(Produto, Produto.id_produto == ItemPedido.id_produto)
        .join(Cliente, Cliente.id_cliente == Produto.id_artista)
        .where(Pedido.status.in_(PAID_STATUSES))
    ).all()
    revenue = sum(float(r.preco_unitario) * r.quantidade for r in rows)

    by_artist: dict[int, dict] = defaultdict(lambda: {"name": "", "sold": 0, "revenue": 0.0})
    for r in rows:
        entry = by_artist[r.id_artista]
        entry["name"] = r.nome
        entry["sold"] += r.quantidade
        entry["revenue"] += float(r.preco_unitario) * r.quantidade

    technique_rows = db.execute(
        select(Categoria.nome, func.count(ItemPedido.id_produto), func.sum(ItemPedido.preco_unitario * ItemPedido.quantidade))
        .join(ProdutoCategoria, ProdutoCategoria.id_categoria == Categoria.id_categoria)
        .join(ItemPedido, ItemPedido.id_produto == ProdutoCategoria.id_produto)
        .join(Pedido, Pedido.id_pedido == ItemPedido.id_pedido)
        .where(Pedido.status.in_(PAID_STATUSES))
        .group_by(Categoria.nome)
        .order_by(func.count(ItemPedido.id_produto).desc())
    ).all()

    status_counts = dict(db.execute(select(Pedido.status, func.count()).group_by(Pedido.status)).all())

    # Catálogo: publicadas com estoque = à venda; publicadas sem estoque = vendidas ou reservadas
    # Subconsulta: o SQL Server não aceita comparação solta no SELECT nem a mesma expressão com parâmetros no GROUP BY
    per_product = (
        select(Produto.status.label("status"), case((func.coalesce(Estoque.quantidade, 0) > 0, 1), else_=0).label("in_stock"))
        .outerjoin(Estoque, Estoque.id_produto == Produto.id_produto)
        .subquery()
    )
    catalog = db.execute(select(per_product.c.status, per_product.c.in_stock, func.count()).group_by(per_product.c.status, per_product.c.in_stock)).all()
    on_sale = sum(n for status, in_stock, n in catalog if status == "PUBLICADA" and in_stock)
    out_of_stock = sum(n for status, in_stock, n in catalog if status == "PUBLICADA" and not in_stock)
    drafts = sum(n for status, _in_stock, n in catalog if status != "PUBLICADA")

    paid_orders = sum(status_counts.get(s, 0) for s in PAID_STATUSES)
    return {
        "revenue": round(revenue, 2),
        "paidOrders": paid_orders,
        "averageTicket": round(revenue / paid_orders, 2) if paid_orders else 0,
        "ordersByStatus": {ORDER_STATUS_OUT[s]: status_counts.get(s, 0) for s in ORDER_STATUS_OUT},
        "catalog": {"onSale": on_sale, "outOfStock": out_of_stock, "drafts": drafts},
        "topArtists": sorted(
            ({"name": e["name"], "sold": e["sold"], "revenue": round(e["revenue"], 2)} for e in by_artist.values()),
            key=lambda e: (-e["revenue"], e["name"]),
        )[:5],
        "salesByTechnique": [{"technique": name, "sold": int(sold), "revenue": round(float(total or 0), 2)} for name, sold, total in technique_rows],
    }
