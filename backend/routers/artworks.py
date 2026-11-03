import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from database import get_db
from deps import current_user, current_user_optional
from errors import ApiError
from models import Categoria, Cliente, Estoque, ItemPedido, Pedido, Produto, ProdutoImagem
from orders_service import expire_orders
from serializers import artwork_view
from uploads import only_filled, read_images, remove_images, save_images
from validators import clean_text, optional_dimension, valid_price

router = APIRouter(tags=["artworks"])


@router.get("/artworks")
def list_artworks(user: Cliente | None = Depends(current_user_optional), db: Session = Depends(get_db)):
    expire_orders(db)  # obras de pedidos vencidos voltam para a vitrine
    query = (
        select(Produto)
        .options(joinedload(Produto.artista), joinedload(Produto.estoque), selectinload(Produto.categorias), selectinload(Produto.imagens))
        .outerjoin(Estoque, Estoque.id_produto == Produto.id_produto)
        .order_by(Produto.id_produto.desc())
    )
    if not user or user.papel != "ADMIN":
        # Vitrine: publicada, ativa e com estoque. Obra vendida ou reservada sai da vitrine.
        visible = (Produto.status == "PUBLICADA") & (Produto.ativo == "S") & (func.coalesce(Estoque.quantidade, 0) > 0)
        if user:
            visible = or_(visible, Produto.id_artista == user.id_cliente)  # o artista vê as próprias obras, inclusive rascunho e vendidas
        query = query.where(visible)
    products = list(db.scalars(query).unique())

    # "reservada" = estoque zerado por um pedido que ainda aguarda pagamento (só importa para quem vê obras sem estoque)
    reserved: set[int] = set()
    if any(p.estoque is None or p.estoque.quantidade <= 0 for p in products):
        reserved = set(db.scalars(
            select(ItemPedido.id_produto).join(Pedido, Pedido.id_pedido == ItemPedido.id_pedido).where(Pedido.status == "AGUARDANDO")
        ))
    return [artwork_view(p, p.id_produto in reserved) for p in products]


@router.post("/artworks", status_code=201)
def create_artwork(
    title: str = Form(""),
    technique: str = Form(""),
    description: str = Form(""),
    price: str = Form(""),
    width: str = Form(""),
    height: str = Form(""),
    year: str = Form(""),
    submitType: str = Form("publish"),
    images: list[UploadFile] = File(default=[]),
    user: Cliente = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user.papel != "ARTISTA" or user.status_artista != "APROVADO":
        raise ApiError(403, "Apenas artistas aprovados podem publicar obras.")

    title = clean_text(title)
    if not 3 <= len(title) <= 150:
        raise ApiError(400, "Dê um título à obra (de 3 a 150 caracteres).", "title")
    categoria = db.scalar(select(Categoria).where(Categoria.nome == clean_text(technique)))
    if not categoria:
        raise ApiError(400, "Escolha uma técnica válida.", "technique")
    description = clean_text(description)
    if len(description) > 4000:
        raise ApiError(400, "A descrição pode ter até 4000 caracteres.", "description")
    value = valid_price(price)
    width_cm, height_cm = optional_dimension(width, "width"), optional_dimension(height, "height")

    year_text = clean_text(year)
    if year_text and not (year_text.isdigit() and 1000 <= int(year_text) <= date.today().year + 1):
        raise ApiError(400, "Informe um ano válido.", "year")
    year_value = int(year_text) if year_text else date.today().year

    files = only_filled(images)
    if not 1 <= len(files) <= 5:
        raise ApiError(400, "Adicione de 1 a 5 imagens da obra.", "images")
    parsed = read_images(files, "images")

    urls = save_images(parsed)
    try:
        produto = Produto(
            id_artista=user.id_cliente, nome=title, descricao=description or None, sku=f"NG-{uuid.uuid4().hex[:12].upper()}",
            preco=value, url_imagem=urls[0], ano=year_value, largura_cm=width_cm, altura_cm=height_cm,
            status="RASCUNHO" if clean_text(submitType) in {"draft", "rascunho"} else "PUBLICADA",
        )
        produto.categorias.append(categoria)
        produto.imagens = [ProdutoImagem(url=url, ordem=order) for order, url in enumerate(urls)]
        produto.estoque = Estoque(quantidade=1)  # obra original: uma unidade
        db.add(produto)
        db.commit()
    except Exception:
        db.rollback()
        remove_images(urls)
        raise

    produto.artista = user
    published = produto.status == "PUBLICADA"
    return {
        "ok": True,
        "message": "Obra publicada com sucesso." if published else "Rascunho salvo.",
        "artwork": artwork_view(produto),
    }
