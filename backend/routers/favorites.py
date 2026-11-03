"""Obras favoritas de cada pessoa (antes ficavam só no navegador)."""
from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from database import get_db
from deps import current_user
from errors import ApiError
from models import Cliente, Favorito, Produto

router = APIRouter(tags=["favorites"])

MAX_FAVORITES = 500


@router.get("/favorites")
def list_favorites(user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    """IDs das obras favoritas; o front cruza com as obras que a vitrine mostra."""
    return [str(i) for i in db.scalars(select(Favorito.id_produto).where(Favorito.id_cliente == user.id_cliente).order_by(Favorito.data_criacao.desc(), Favorito.id_produto.desc()))]


@router.post("/favorites/{artwork_id}")
def add_favorite(artwork_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    produto = db.get(Produto, artwork_id)
    if not produto or produto.status != "PUBLICADA" or produto.ativo != "S":
        raise ApiError(404, "Obra não encontrada.")
    if db.get(Favorito, (user.id_cliente, artwork_id)):
        return {"ok": True, "message": "Obra já está nos favoritos."}
    if db.scalar(select(func.count()).select_from(Favorito).where(Favorito.id_cliente == user.id_cliente)) >= MAX_FAVORITES:
        raise ApiError(400, f"Você pode favoritar até {MAX_FAVORITES} obras.")
    db.add(Favorito(id_cliente=user.id_cliente, id_produto=artwork_id))
    db.commit()
    return {"ok": True, "message": "Obra favoritada."}


@router.delete("/favorites/{artwork_id}")
def remove_favorite(artwork_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(Favorito).where(Favorito.id_cliente == user.id_cliente, Favorito.id_produto == artwork_id))
    db.commit()
    return {"ok": True, "message": "Obra removida dos favoritos."}
