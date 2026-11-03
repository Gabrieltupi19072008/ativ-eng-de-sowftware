from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database import get_db
from deps import require_admin
from errors import ApiError
from models import Cliente
from serializers import STATUS_IN, candidate_view

router = APIRouter(tags=["artists"])


class ReviewIn(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=500)


@router.get("/artists")
def list_artists(
    status: Literal["pending", "approved", "rejected"] = Query("pending"),
    _admin: Cliente = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = (
        select(Cliente)
        .options(selectinload(Cliente.portfolio))
        .where(Cliente.papel == "ARTISTA", Cliente.status_artista == STATUS_IN[status])
        .order_by(Cliente.data_cadastro, Cliente.id_cliente)
    )
    return [candidate_view(c) for c in db.scalars(query)]


@router.patch("/artists/{artist_id}")
def review_artist(artist_id: int, body: ReviewIn, admin: Cliente = Depends(require_admin), db: Session = Depends(get_db)):
    artist = db.scalar(select(Cliente).where(Cliente.id_cliente == artist_id, Cliente.papel == "ARTISTA"))
    if not artist:
        raise ApiError(404, "Artista não encontrado.")
    if artist.status_artista != "PENDENTE":
        raise ApiError(409, "Este cadastro já foi analisado.")

    artist.status_artista = STATUS_IN[body.decision]
    artist.observacao_revisao = body.note.strip() or None
    artist.id_revisor = admin.id_cliente
    artist.data_revisao = datetime.now()
    db.commit()
    return {
        "ok": True,
        "message": "Artista aprovado para vender." if body.decision == "approved" else "Cadastro devolvido com observações.",
    }
