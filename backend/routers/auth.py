import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session

import config
from database import get_db
from deps import current_user
from email_templates import password_reset_email
from errors import ApiError
from mailer import send_mail
from models import Cliente, RedefinicaoSenha
from security import LoginLimiter, clear_session_cookie, hash_password, login_limiter, set_session_cookie, verify_password
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


# ---------- esqueci minha senha ----------
forgot_limiter = LoginLimiter()  # 5 pedidos em 15 min por IP + e-mail: impede encher a caixa de entrada de alguém


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class ForgotIn(BaseModel):
    email: str


@router.post("/auth/forgot-password")
def forgot_password(body: ForgotIn, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    key = f"{request.client.host if request.client else '-'}|{email}"
    if forgot_limiter.blocked(key):
        raise ApiError(429, "Muitos pedidos. Aguarde alguns minutos e tente de novo.")
    forgot_limiter.fail(key)  # conta todo pedido, exista a conta ou não

    user = db.scalar(select(Cliente).where(Cliente.email == email))
    if user and user.ativo == "S":
        token = secrets.token_urlsafe(32)
        db.execute(update(RedefinicaoSenha).where(RedefinicaoSenha.id_cliente == user.id_cliente, RedefinicaoSenha.usado == "N").values(usado="S"))  # só o link mais novo vale
        db.add(RedefinicaoSenha(id_cliente=user.id_cliente, token_hash=_token_hash(token), data_expiracao=datetime.now() + timedelta(minutes=config.RESET_TOKEN_MINUTES)))
        db.commit()
        link = f"{config.FRONTEND_URL}/?reset={token}"
        text, html = password_reset_email(user.nome, link, config.RESET_TOKEN_MINUTES)
        background.add_task(send_mail, user.email, "Redefinição de senha — Nambá Galerie", text, html)
    # Mesma resposta exista a conta ou não: ninguém descobre quem tem cadastro.
    return {"ok": True, "message": "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Confira também o spam."}


class ResetIn(BaseModel):
    token: str
    newPassword: str


@router.post("/auth/reset-password")
def reset_password(body: ResetIn, db: Session = Depends(get_db)):
    if not 8 <= len(body.newPassword) <= 128:
        raise ApiError(400, "A nova senha deve ter entre 8 e 128 caracteres.", "newPassword")
    record = db.scalar(select(RedefinicaoSenha).where(RedefinicaoSenha.token_hash == _token_hash(body.token.strip())))
    if not record or record.usado != "N" or record.data_expiracao < datetime.now():
        raise ApiError(400, "Este link é inválido ou já expirou. Peça um novo em \"Esqueci minha senha\".", "token")
    user = db.get(Cliente, record.id_cliente)
    if not user or user.ativo != "S":
        raise ApiError(400, "Este link é inválido ou já expirou. Peça um novo em \"Esqueci minha senha\".", "token")
    user.senha_hash = hash_password(body.newPassword)
    db.execute(update(RedefinicaoSenha).where(RedefinicaoSenha.id_cliente == user.id_cliente).values(usado="S"))  # o link só vale uma vez
    db.commit()
    return {"ok": True, "message": "Senha redefinida. Entre com a nova senha."}
