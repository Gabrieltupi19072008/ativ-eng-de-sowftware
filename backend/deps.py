from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from database import get_db
from errors import ApiError
from models import Cliente
from security import read_token


def current_user_optional(request: Request, db: Session = Depends(get_db)) -> Cliente | None:
    user_id = read_token(request.cookies.get(config.COOKIE_NAME))
    if user_id is None:
        return None
    user = db.scalar(select(Cliente).where(Cliente.id_cliente == user_id))
    return user if user and user.ativo == "S" else None


def current_user(user: Cliente | None = Depends(current_user_optional)) -> Cliente:
    if not user:
        raise ApiError(401, "Faça login para continuar.")
    return user


def require_admin(user: Cliente = Depends(current_user)) -> Cliente:
    if user.papel != "ADMIN":
        raise ApiError(403, "Acesso restrito à administração.")
    return user
