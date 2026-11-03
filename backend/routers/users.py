import re

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from errors import ApiError
from models import Cliente, Endereco, PortfolioImagem
from security import hash_password, set_session_cookie
from serializers import ROLE_IN, user_view
from uploads import only_filled, read_images, remove_images, save_images
from validators import clean_text, valid_cpf, valid_email

router = APIRouter(tags=["users"])

DUPLICATE = "Não foi possível criar a conta. Verifique se o e-mail ou o CPF já está em uso."


def _address(cep: str, street: str, number: str, complement: str, neighborhood: str, city: str, state: str):
    """Rua, CEP e bairro são opcionais no cadastro; se algum vier, o endereço precisa vir completo (menos número e complemento).
    Cidade e estado sozinhos ficam só no perfil."""
    if state and not re.fullmatch(r"[A-Za-z]{2}", state):
        raise ApiError(400, "Informe o estado com 2 letras (ex.: SP).", "state")
    if not any((cep, street, number, complement, neighborhood)):
        return None
    digits = re.sub(r"\D", "", cep)
    if len(digits) != 8:
        raise ApiError(400, "Informe um CEP válido.", "cep")
    for value, field, label in ((street, "street", "a rua"), (neighborhood, "neighborhood", "o bairro"), (city, "city", "a cidade"), (state, "state", "o estado")):
        if not value:
            raise ApiError(400, f"Informe {label}.", field)
    return Endereco(
        tipo="ENTREGA", logradouro=street[:150], numero=(number or "S/N")[:20], complemento=complement[:100] or None,
        bairro=neighborhood[:80], cidade=city[:80], estado=state.upper(), cep=f"{digits[:5]}-{digits[5:]}",
    )


@router.post("/users", status_code=201)
def register(
    response: Response,
    role: str = Form(""),
    name: str = Form(""),
    email: str = Form(""),
    password: str = Form(""),
    cpf: str = Form(""),
    phone: str = Form(""),
    cep: str = Form(""),
    street: str = Form(""),
    number: str = Form(""),
    complement: str = Form(""),
    neighborhood: str = Form(""),
    city: str = Form(""),
    state: str = Form(""),
    artStyle: str = Form(""),
    artistBio: str = Form(""),
    portfolio: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    role = clean_text(role)
    if role not in ROLE_IN:
        raise ApiError(400, "Escolha um perfil válido.", "role")
    name = clean_text(name)
    if len(name) < 3 or len(name) > 120:
        raise ApiError(400, "Informe seu nome completo.", "name")
    email = valid_email(email)
    if len(email) > 160:
        raise ApiError(400, "Informe um e-mail válido.", "email")
    if not 8 <= len(password) <= 128:
        raise ApiError(400, "A senha deve ter entre 8 e 128 caracteres.", "password")
    cpf_digits = valid_cpf(cpf)
    phone_digits = re.sub(r"\D", "", phone)
    if phone_digits and not 10 <= len(phone_digits) <= 11:
        raise ApiError(400, "Informe o celular com DDD (ex.: (11) 99999-9999).", "phone")

    city, state = clean_text(city), clean_text(state)
    endereco = _address(clean_text(cep), clean_text(street), clean_text(number), clean_text(complement), clean_text(neighborhood), city, state)

    art_style, bio, images = None, None, []
    if role == "artist":
        art_style, bio = clean_text(artStyle), clean_text(artistBio)
        if not art_style or len(art_style) > 80:
            raise ApiError(400, "Informe sua técnica ou estilo principal.", "artStyle")
        if len(bio) < 60 or len(bio) > 2000:
            raise ApiError(400, "Conte sobre sua pesquisa artística (de 60 a 2000 caracteres).", "artistBio")
        files = only_filled(portfolio)
        if not 2 <= len(files) <= 5:
            raise ApiError(400, "Anexe de 2 a 5 obras do seu portfólio.", "portfolio")
        images = read_images(files, "portfolio")

    if db.scalar(select(Cliente.id_cliente).where(or_(Cliente.email == email, Cliente.cpf == cpf_digits))):
        raise ApiError(409, DUPLICATE)

    urls = save_images(images)
    try:
        cliente = Cliente(
            nome=name, email=email, senha_hash=hash_password(password), cpf=cpf_digits, telefone=phone_digits or None,
            papel=ROLE_IN[role], status_artista="PENDENTE" if role == "artist" else "NAO_APLICAVEL",
            cidade=(city or None), estado=state.upper() or None,
            estilo_artistico=art_style, biografia=bio,
        )
        if endereco:
            cliente.enderecos.append(endereco)
        for order, url in enumerate(urls):
            cliente.portfolio.append(PortfolioImagem(url=url, ordem=order))
        db.add(cliente)
        db.commit()
    except IntegrityError:
        db.rollback()
        remove_images(urls)
        raise ApiError(409, DUPLICATE)
    except Exception:
        db.rollback()
        remove_images(urls)
        raise

    set_session_cookie(response, cliente.id_cliente)
    message = "Cadastro enviado. Seu portfólio será analisado em até 48h." if role == "artist" else "Conta criada. Bem-vindo à Nambá Galerie."
    return {"ok": True, "message": message, "user": user_view(cliente)}
