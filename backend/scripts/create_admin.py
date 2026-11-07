"""Cria a conta de ADMINISTRADOR (a curadoria que aprova artistas). Use no site publicado no lugar do seed.py.

Uso (dentro de backend/):
    .venv/bin/python scripts/create_admin.py --email voce@gmail.com --name "Seu Nome"

Para criar no banco do SUPABASE (site publicado), informe o endereço do banco só neste comando, sem gravar no .env:
    DATABASE_URL='postgresql://...pooler.supabase.com:5432/postgres' .venv/bin/python scripts/create_admin.py --email ...

A senha é pedida escondida no terminal (não aparece na tela nem fica no histórico). Antes de gravar, o script mostra em QUAL banco vai
gravar e pede para você digitar "sim". Recusa e-mail que já existe."""
import argparse
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from database import SessionLocal, engine
from errors import ApiError
from models import Cliente
from security import hash_password
from validators import valid_email

MIN_PASSWORD = 12


def ask_password() -> str:
    # ADMIN_PASSWORD existe só para automação/testes; no uso normal a senha é digitada escondida
    password = os.getenv("ADMIN_PASSWORD")
    if password:
        return password
    first = getpass.getpass(f"Senha do administrador (mínimo {MIN_PASSWORD} caracteres): ")
    if getpass.getpass("Repita a senha: ") != first:
        sys.exit("As senhas não são iguais. Nada foi gravado.")
    return first


def main():
    parser = argparse.ArgumentParser(description="Cria a conta de administrador.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Curadoria Nambá")
    parser.add_argument("--yes", action="store_true", help="não pergunta a confirmação (use só em testes)")
    args = parser.parse_args()

    try:
        email = valid_email(args.email)
    except ApiError as error:
        sys.exit(error.message if hasattr(error, "message") else "E-mail inválido.")
    name = args.name.strip()
    if not 2 <= len(name) <= 120:
        sys.exit("O nome precisa ter entre 2 e 120 caracteres.")

    url = engine.url
    print(f"\nBanco de destino: {url.drivername} · {url.host or 'arquivo local'}:{url.port or ''}/{url.database}")
    print(f"Conta a criar:    {name} <{email}> (administrador)")
    if not args.yes and input('Digite "sim" para criar: ').strip().lower() != "sim":
        sys.exit("Cancelado. Nada foi gravado.")

    password = ask_password()
    if len(password) < MIN_PASSWORD or len(password) > 128:
        sys.exit(f"A senha precisa ter de {MIN_PASSWORD} a 128 caracteres. Nada foi gravado.")
    if password.lower() == email.split("@")[0].lower():
        sys.exit("A senha não pode ser igual ao seu e-mail. Nada foi gravado.")

    with SessionLocal() as db:
        if db.scalar(select(Cliente.id_cliente).where(Cliente.email == email)):
            sys.exit("Já existe uma conta com esse e-mail. Nada foi gravado.")
        db.add(Cliente(nome=name, email=email, senha_hash=hash_password(password), papel="ADMIN", status_artista="NAO_APLICAVEL"))
        db.commit()
    print("Administrador criado. Entre no site com esse e-mail e a senha que você acabou de digitar.")


if __name__ == "__main__":
    main()
