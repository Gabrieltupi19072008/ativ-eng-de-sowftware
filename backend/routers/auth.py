from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from deps import current_user
from errors import ApiError
from models import Cliente
from security import clear_session_cookie, login_limiter, set_session_cookie, verify_password
from serializers import user_view

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    # A chave inclui o IP: assim um desconhecido não consegue bloquear a conta de outra pessoa.
    attempts_key = f"{request.client.host if request.client else '-'}|{email}"
    if login_limiter.blocked(attempts_key):
        raise ApiError(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo.")

    user = db.scalar(select(Cliente).where(Cliente.email == email))
    valid = verify_password(body.password, user.senha_hash if user else None)
    if not user or not valid or user.ativo != "S":
        login_limiter.fail(attempts_key)
        raise ApiError(401, "E-mail ou senha inválidos.")

    login_limiter.reset(attempts_key)
    set_session_cookie(response, user.id_cliente)
    return {"ok": True, "message": "Bem-vindo à Nambá Galerie.", "user": user_view(user)}


@router.post("/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True, "message": "Sessão encerrada."}


@router.get("/me")
def me(user: Cliente = Depends(current_user)):
    return user_view(user)
