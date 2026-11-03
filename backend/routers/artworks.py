import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from database import get_db
from deps import current_user, current_user_optional, require_admin
from errors import ApiError
from models import Categoria, Cliente, Estoque, ItemPedido, Pedido, Produto, ProdutoCategoria, ProdutoImagem
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


def _validated(db: Session, title: str, technique: str, description: str, price: str, width: str, height: str, year: str) -> dict:
    """Valida os campos de texto de uma obra (usado ao criar e ao editar) e devolve os valores prontos para o banco."""
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
    return {"title": title, "categoria": categoria, "description": description or None, "price": value, "width": width_cm, "height": height_cm, "year": year_value}


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

    fields = _validated(db, title, technique, description, price, width, height, year)

    files = only_filled(images)
    if not 1 <= len(files) <= 5:
        raise ApiError(400, "Adicione de 1 a 5 imagens da obra.", "images")
    parsed = read_images(files, "images")

    urls = save_images(parsed)
    try:
        produto = Produto(
            id_artista=user.id_cliente, nome=fields["title"], descricao=fields["description"], sku=f"NG-{uuid.uuid4().hex[:12].upper()}",
            preco=fields["price"], url_imagem=urls[0], ano=fields["year"], largura_cm=fields["width"], altura_cm=fields["height"],
            status="RASCUNHO" if clean_text(submitType) in {"draft", "rascunho"} else "PUBLICADA",
        )
        produto.categorias.append(fields["categoria"])
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


class ArtworkEdit(BaseModel):
    title: str = Field(max_length=200)
    technique: str = Field(max_length=80)
    description: str = Field(default="", max_length=5000)
    price: str = Field(max_length=30)
    width: str = Field(default="", max_length=20)
    height: str = Field(default="", max_length=20)
    year: str = Field(default="", max_length=10)
    submitType: str = Field(default="publish", max_length=20)


def _own_artwork(db: Session, artwork_id: int, user: Cliente) -> Produto:
    """Obra do artista logado que ainda pode ser mexida: nada de obra reservada, vendida ou despublicada pela curadoria."""
    produto = db.scalar(
        select(Produto)
        .options(joinedload(Produto.artista), joinedload(Produto.estoque), selectinload(Produto.categorias), selectinload(Produto.imagens))
        .where(Produto.id_produto == artwork_id)
    )
    if not produto or produto.id_artista != user.id_cliente or user.papel != "ARTISTA":
        raise ApiError(404, "Obra não encontrada.")  # 404 também para obra de outra pessoa
    expire_orders(db)
    db.refresh(produto)
    if produto.estoque is None or produto.estoque.quantidade < 1:
        raise ApiError(409, "Esta obra está reservada ou já foi vendida e não pode mais ser alterada.")
    if produto.ativo != "S":
        raise ApiError(403, "Esta obra foi despublicada pela curadoria. Fale com a administração.")
    return produto


@router.patch("/artworks/{artwork_id}")
def edit_artwork(artwork_id: int, body: ArtworkEdit, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    """O artista edita os dados da obra e escolhe entre publicada e rascunho (as imagens não mudam aqui)."""
    produto = _own_artwork(db, artwork_id, user)
    fields = _validated(db, body.title, body.technique, body.description, body.price, body.width, body.height, body.year)
    produto.nome, produto.descricao, produto.preco = fields["title"], fields["description"], fields["price"]
    produto.ano, produto.largura_cm, produto.altura_cm = fields["year"], fields["width"], fields["height"]
    produto.categorias = [fields["categoria"]]
    produto.status = "RASCUNHO" if clean_text(body.submitType) in {"draft", "rascunho"} else "PUBLICADA"
    db.commit()
    return {"ok": True, "message": "Obra atualizada." if produto.status == "PUBLICADA" else "Obra salva como rascunho.", "artwork": artwork_view(produto)}


@router.delete("/artworks/{artwork_id}")
def delete_artwork(artwork_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    """Exclui de vez uma obra que nunca fez parte de um pedido. Se já teve pedido (mesmo cancelado), o histórico precisa dela:
    nesse caso o artista deve salvar como rascunho em vez de excluir."""
    produto = _own_artwork(db, artwork_id, user)
    if db.scalar(select(func.count()).select_from(ItemPedido).where(ItemPedido.id_produto == artwork_id)):
        raise ApiError(409, "Esta obra já apareceu em um pedido e não pode ser excluída. Salve-a como rascunho para tirá-la da vitrine.")
    urls = [produto.url_imagem] + [i.url for i in produto.imagens]
    for table in (ProdutoImagem, ProdutoCategoria, Estoque):
        db.execute(delete(table).where(table.id_produto == artwork_id))
    db.execute(delete(Produto).where(Produto.id_produto == artwork_id))
    db.commit()
    remove_images(list(dict.fromkeys(urls)))
    return {"ok": True, "message": "Obra excluída."}


class VisibilityIn(BaseModel):
    visible: bool


@router.patch("/artworks/{artwork_id}/visibility")
def set_visibility(artwork_id: int, body: VisibilityIn, _admin: Cliente = Depends(require_admin), db: Session = Depends(get_db)):
    """A administração tira uma obra da vitrine (ou a devolve). O artista não consegue desfazer isso."""
    produto = db.scalar(
        select(Produto)
        .options(joinedload(Produto.artista), joinedload(Produto.estoque), selectinload(Produto.categorias), selectinload(Produto.imagens))
        .where(Produto.id_produto == artwork_id)
    )
    if not produto:
        raise ApiError(404, "Obra não encontrada.")
    produto.ativo = "S" if body.visible else "N"
    db.commit()
    return {"ok": True, "message": "Obra devolvida à vitrine." if body.visible else "Obra despublicada.", "artwork": artwork_view(produto)}
