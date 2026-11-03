import re
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

import config
from database import get_db
from deps import current_user
from errors import ApiError
from models import Cliente, Endereco, Estoque, ItemPedido, Pagamento, Pedido, Produto
from orders_service import can_fulfil, cancel_waiting_order, expire_orders, mark_delivered, mark_paid, mark_shipped, order_artist_ids
from serializers import PAYMENT_IN, order_view

router = APIRouter(tags=["orders"])


class AddressIn(BaseModel):
    cep: str = Field(max_length=20)
    street: str = Field(max_length=150)
    number: str = Field(max_length=20)
    complement: str = Field(default="", max_length=100)
    neighborhood: str = Field(max_length=80)
    city: str = Field(max_length=80)
    state: str = Field(max_length=2)


class OrderIn(BaseModel):
    items: list[str] = Field(max_length=50)
    address: AddressIn
    paymentMethod: Literal["pix", "boleto", "credit"]
    # Só envio por enquanto. A retirada (mesma cidade) entra junto com o cálculo de frete.
    deliveryType: Literal["shipping"] = "shipping"


def _view(order: Pedido) -> dict:
    return order_view(order, config.FAKE_PAYMENTS)


def _load(db: Session, order_id: int) -> Pedido | None:
    query = (
        select(Pedido)
        .options(
            selectinload(Pedido.itens).joinedload(ItemPedido.produto).joinedload(Produto.artista),
            joinedload(Pedido.endereco),
            joinedload(Pedido.pagamento),
            joinedload(Pedido.entrega),
        )
        .where(Pedido.id_pedido == order_id)
        .execution_options(populate_existing=True)
    )
    return db.scalars(query).unique().first()


def _own_or_admin(db: Session, order_id: int, user: Cliente) -> Pedido:
    order = _load(db, order_id)
    # 404 (e não 403) para não revelar que o pedido de outra pessoa existe
    if not order or (order.id_cliente != user.id_cliente and user.papel != "ADMIN"):
        raise ApiError(404, "Pedido não encontrado.")
    return order


def _shipping_address(db: Session, user: Cliente, data: AddressIn) -> Endereco:
    cep = re.sub(r"\D", "", data.cep)
    street, number, neighborhood, city = (v.strip() for v in (data.street, data.number, data.neighborhood, data.city))
    complement, state = data.complement.strip(), data.state.strip().upper()
    if len(cep) != 8:
        raise ApiError(400, "Informe um CEP válido.", "cep")
    for value, field, label in ((street, "street", "a rua"), (number, "number", "o número"), (neighborhood, "neighborhood", "o bairro"), (city, "city", "a cidade")):
        if not value:
            raise ApiError(400, f"Informe {label}.", field)
    if not re.fullmatch(r"[A-Z]{2}", state):
        raise ApiError(400, "Informe o estado com 2 letras (ex.: SP).", "state")
    formatted = f"{cep[:5]}-{cep[5:]}"

    complement_matches = Endereco.complemento == complement if complement else Endereco.complemento.is_(None)
    existing = db.scalar(
        select(Endereco).where(
            Endereco.id_cliente == user.id_cliente, Endereco.tipo == "ENTREGA", Endereco.cep == formatted, Endereco.logradouro == street,
            Endereco.numero == number, Endereco.bairro == neighborhood, Endereco.cidade == city, Endereco.estado == state, complement_matches,
        )
    )
    if existing:
        return existing
    address = Endereco(
        id_cliente=user.id_cliente, tipo="ENTREGA", logradouro=street, numero=number, complemento=complement or None,
        bairro=neighborhood, cidade=city, estado=state, cep=formatted,
    )
    db.add(address)
    db.flush()
    return address


def _unavailable(titles: list[str], ids: list[str], message: str | None = None) -> ApiError:
    if message is None:
        message = (f"A obra “{titles[0]}” acabou de ser vendida ou reservada." if len(titles) == 1
                   else "Estas obras acabaram de ser vendidas ou reservadas: " + ", ".join(f"“{t}”" for t in titles) + ".")
    return ApiError(409, message, "items", {"unavailable": ids})


@router.post("/orders", status_code=201)
def create_order(body: OrderIn, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)  # pedidos vencidos devolvem as obras antes de checarmos o estoque

    try:
        ids = list(dict.fromkeys(int(i) for i in body.items))  # sem repetidas, na ordem recebida
    except ValueError:
        raise ApiError(400, "Carrinho inválido.", "items")
    if not 1 <= len(ids) <= config.MAX_ORDER_ITEMS:
        raise ApiError(400, f"Escolha de 1 a {config.MAX_ORDER_ITEMS} obras por pedido.", "items")

    products = {p.id_produto: p for p in db.scalars(select(Produto).options(joinedload(Produto.estoque)).where(Produto.id_produto.in_(ids)))}
    missing = [str(i) for i in ids if i not in products or products[i].status != "PUBLICADA" or products[i].ativo != "S"]
    if missing:
        raise _unavailable([], missing, "Uma ou mais obras do carrinho não estão mais à venda.")
    own = [p for p in products.values() if p.id_artista == user.id_cliente]
    if own:
        raise ApiError(400, "Você não pode comprar a sua própria obra.", "items", {"unavailable": [str(p.id_produto) for p in own]})

    address = _shipping_address(db, user, body.address)

    order = Pedido(
        id_cliente=user.id_cliente, id_endereco_entrega=address.id_endereco, status="AGUARDANDO", valor_frete=0, tipo_entrega="ENVIO",
        data_pedido=datetime.now(), data_expiracao=datetime.now() + timedelta(hours=config.ORDER_EXPIRY_HOURS),
    )
    db.add(order)
    db.flush()

    sold_out = []
    for product_id in sorted(ids):  # ordem fixa evita travamento mútuo entre pedidos simultâneos
        taken = db.execute(update(Estoque).where(Estoque.id_produto == product_id, Estoque.quantidade >= 1).values(quantidade=Estoque.quantidade - 1))
        if taken.rowcount != 1:
            sold_out.append(products[product_id])
    if sold_out:
        db.rollback()  # desfaz o pedido e as baixas já feitas
        raise _unavailable([p.nome for p in sold_out], [str(p.id_produto) for p in sold_out])

    for product_id in ids:
        db.add(ItemPedido(id_pedido=order.id_pedido, id_produto=product_id, quantidade=1, preco_unitario=products[product_id].preco))
    total = sum(products[i].preco for i in ids) + order.valor_frete
    db.add(Pagamento(id_pedido=order.id_pedido, forma=PAYMENT_IN[body.paymentMethod], status="PENDENTE", valor=total))
    db.commit()

    return {"ok": True, "message": "Pedido registrado. Aguardando pagamento.", "order": _view(_load(db, order.id_pedido))}


@router.get("/orders")
def my_orders(user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)
    ids = list(db.scalars(select(Pedido.id_pedido).where(Pedido.id_cliente == user.id_cliente).order_by(Pedido.id_pedido.desc())))
    return [_view(_load(db, order_id)) for order_id in ids]


@router.get("/orders/{order_id}")
def get_order(order_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)
    return _view(_own_or_admin(db, order_id, user))


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)
    _own_or_admin(db, order_id, user)
    if not cancel_waiting_order(db, order_id):
        db.rollback()
        raise ApiError(409, "Este pedido não pode mais ser cancelado.")
    db.commit()
    return {"ok": True, "message": "Pedido cancelado. As obras voltaram para a vitrine.", "order": _view(_load(db, order_id))}


class ShipIn(BaseModel):
    trackingCode: str = Field(max_length=60)
    carrier: str = Field(default="Correios", max_length=100)


def _fulfiller_order(db: Session, order_id: int, user: Cliente) -> Pedido:
    order = _load(db, order_id)
    # 404 (e não 403) para não revelar pedidos de outras pessoas
    if not order or not can_fulfil(user, order_artist_ids(db, order_id)):
        raise ApiError(404, "Pedido não encontrado.")
    return order


@router.post("/orders/{order_id}/ship")
def ship_order(order_id: int, body: ShipIn, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    """O artista (ou o administrador) informa o código de rastreio e o pedido pago passa a 'enviado'."""
    expire_orders(db)
    _fulfiller_order(db, order_id, user)
    code = body.trackingCode.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{5,60}", code):
        raise ApiError(400, "Informe um código de rastreio válido (5 a 60 letras e números, sem espaços).", "trackingCode")
    carrier = body.carrier.strip() or "Correios"
    try:
        shipped = mark_shipped(db, order_id, code, carrier)
        if shipped:
            db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "Este código de rastreio já foi usado em outro pedido.", "trackingCode")
    if not shipped:
        db.rollback()
        raise ApiError(409, "Só é possível enviar um pedido que já foi pago e ainda não foi enviado.")
    return {"ok": True, "message": "Pedido marcado como enviado.", "order": _view(_load(db, order_id))}


@router.post("/orders/{order_id}/deliver")
def deliver_order(order_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)
    _fulfiller_order(db, order_id, user)
    if not mark_delivered(db, order_id):
        db.rollback()
        raise ApiError(409, "Só é possível marcar como entregue um pedido que já foi enviado.")
    db.commit()
    return {"ok": True, "message": "Pedido marcado como entregue.", "order": _view(_load(db, order_id))}


@router.post("/orders/{order_id}/simulate-payment")
def simulate_payment(order_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    """Marca como pago SEM cobrar nada. Só existe em desenvolvimento; será substituído pelo webhook do gateway."""
    if not config.FAKE_PAYMENTS:
        raise ApiError(404, "Não encontrado.")
    expire_orders(db)
    _own_or_admin(db, order_id, user)
    if not mark_paid(db, order_id):
        db.rollback()
        raise ApiError(409, "Este pedido não está aguardando pagamento.")
    db.commit()
    return {"ok": True, "message": "Pagamento simulado com sucesso.", "order": _view(_load(db, order_id))}
