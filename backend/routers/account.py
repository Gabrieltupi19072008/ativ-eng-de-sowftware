"""Conta do usuário: dados pessoais, endereços e troca de senha."""
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from addresses import AddressIn, clean_address
from database import get_db
from deps import current_user
from errors import ApiError
from models import Cliente, Endereco, Pedido
from security import hash_password, login_limiter, verify_password
from serializers import active_addresses, address_view, user_view
from validators import clean_text, optional_birth_date

router = APIRouter(tags=["account"])

MAX_ADDRESSES = 10


class ProfileIn(BaseModel):
    name: str = Field(max_length=200)
    phone: str = Field(default="", max_length=30)
    city: str = Field(default="", max_length=120)
    state: str = Field(default="", max_length=10)
    bio: str = Field(default="", max_length=5000)
    birthDate: str = Field(default="", max_length=20)


@router.patch("/me")
def update_profile(body: ProfileIn, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    """Dados pessoais. O e-mail e o CPF não mudam por aqui (o e-mail é o login e o CPF identifica a pessoa)."""
    name = clean_text(body.name)
    if not 3 <= len(name) <= 120:
        raise ApiError(400, "Informe seu nome completo.", "name")
    phone = re.sub(r"\D", "", body.phone)
    if phone and not 10 <= len(phone) <= 11:
        raise ApiError(400, "Informe o celular com DDD (ex.: (11) 99999-9999).", "phone")
    birth_date = optional_birth_date(body.birthDate)
    city, state = clean_text(body.city), clean_text(body.state).upper()
    if len(city) > 80:
        raise ApiError(400, "Informe uma cidade válida.", "city")
    if state and not re.fullmatch(r"[A-Z]{2}", state):
        raise ApiError(400, "Informe o estado com 2 letras (ex.: SP).", "state")
    if user.papel == "ARTISTA":
        bio = clean_text(body.bio)
        if not 60 <= len(bio) <= 2000:
            raise ApiError(400, "Conte sobre sua pesquisa artística (de 60 a 2000 caracteres).", "bio")
        user.biografia = bio
    user.nome, user.telefone, user.cidade, user.estado = name, phone or None, city or None, state or None
    user.data_nascimento = birth_date
    db.commit()
    return {"ok": True, "message": "Dados atualizados.", "user": user_view(user)}


class PasswordIn(BaseModel):
    currentPassword: str = Field(max_length=200)
    newPassword: str = Field(max_length=200)


@router.post("/me/password")
def change_password(body: PasswordIn, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    key = f"password|{user.id_cliente}"
    if login_limiter.blocked(key):  # quem roubou uma sessão aberta não pode ficar adivinhando a senha atual
        raise ApiError(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo.")
    if not verify_password(body.currentPassword, user.senha_hash):
        login_limiter.fail(key)
        raise ApiError(400, "A senha atual está incorreta.", "currentPassword")
    login_limiter.reset(key)
    if not 8 <= len(body.newPassword) <= 128:
        raise ApiError(400, "A nova senha deve ter entre 8 e 128 caracteres.", "newPassword")
    if body.newPassword == body.currentPassword:
        raise ApiError(400, "A nova senha precisa ser diferente da atual.", "newPassword")
    user.senha_hash = hash_password(body.newPassword)
    db.commit()
    return {"ok": True, "message": "Senha alterada."}


# ---------- endereços ----------
def _own_address(db: Session, address_id: int, user: Cliente) -> Endereco:
    address = db.get(Endereco, address_id)
    if not address or address.id_cliente != user.id_cliente or address.tipo != "ENTREGA" or address.ativo != "S":
        raise ApiError(404, "Endereço não encontrado.")
    return address


def _fill(address: Endereco, a: dict) -> None:
    address.logradouro, address.numero, address.complemento = a["street"], a["number"], a["complement"]
    address.bairro, address.cidade, address.estado, address.cep = a["neighborhood"], a["city"], a["state"], a["cep"]


@router.get("/me/addresses")
def list_addresses(user: Cliente = Depends(current_user)):
    return [address_view(e) for e in active_addresses(user)]


@router.post("/me/addresses", status_code=201)
def add_address(body: AddressIn, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    a = clean_address(body)
    if len(active_addresses(user)) >= MAX_ADDRESSES:
        raise ApiError(400, f"Você pode ter até {MAX_ADDRESSES} endereços. Exclua algum para adicionar outro.")
    address = Endereco(id_cliente=user.id_cliente, tipo="ENTREGA", ativo="S")
    _fill(address, a)
    db.add(address)
    db.commit()
    return {"ok": True, "message": "Endereço adicionado.", "address": address_view(address)}


@router.patch("/me/addresses/{address_id}")
def edit_address(address_id: int, body: AddressIn, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    address = _own_address(db, address_id, user)
    a = clean_address(body)
    used = db.scalar(select(func.count()).select_from(Pedido).where(Pedido.id_endereco_entrega == address_id))
    if used:
        # Pedidos antigos continuam apontando para o endereço como era: a edição vira um endereço novo e o antigo sai da conta.
        address.ativo = "N"
        address = Endereco(id_cliente=user.id_cliente, tipo="ENTREGA", ativo="S")
        db.add(address)
    _fill(address, a)
    db.commit()
    return {"ok": True, "message": "Endereço atualizado.", "address": address_view(address)}


@router.delete("/me/addresses/{address_id}")
def delete_address(address_id: int, user: Cliente = Depends(current_user), db: Session = Depends(get_db)):
    address = _own_address(db, address_id, user)
    address.ativo = "N"  # some da conta; o histórico dos pedidos continua intacto
    db.commit()
    return {"ok": True, "message": "Endereço excluído."}
