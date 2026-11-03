import os
import sys
import tempfile
from pathlib import Path

# O ambiente precisa estar pronto ANTES de importar a API (ela lê as variáveis ao ser importada).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "segredo-de-teste-com-mais-de-32-caracteres!"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="namba-uploads-")
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["ENVIRONMENT"] = "development"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

import seed
from database import Base, SessionLocal, engine
from main import app
from security import login_limiter

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
VALID_CPF = "529.982.247-25"
OTHER_CPF = "111.444.777-35"

ACCOUNTS = {
    "buyer": ("comprador@nambagalerie.com", "comprador@123"),
    "artist": ("comerciante@nambagalerie.com", "comerciante@123"),
    "admin": ("admin@nambagalerie.com", "nambagalerie@"),
    "pending": ("isabela@galerie.demo", "Galerie123!"),
}


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed.run(db)
    login_limiter.clear_all()


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    with TestClient(app, base_url="http://localhost:8000") as c:
        yield c


def login(client: TestClient, who: str):
    email, password = ACCOUNTS[who]
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


@pytest.fixture
def as_(client):
    """as_('admin') entra com a conta de teste e devolve o mesmo client já autenticado."""
    def _login(who: str):
        login(client, who)
        return client
    return _login


def buyer_form(**overrides) -> dict:
    data = {
        "role": "buyer", "name": "Joana Silva", "email": "joana@example.com", "password": "senha-forte-1",
        "cpf": VALID_CPF, "cep": "01001-000", "street": "Praça da Sé", "number": "10", "complement": "",
        "neighborhood": "Sé", "city": "São Paulo", "state": "SP",
    }
    data.update(overrides)
    return data


def artist_form(**overrides) -> dict:
    data = {
        "role": "artist", "name": "Rafael Costa", "email": "rafael@example.com", "artStyle": "Óleo",
        "artistBio": "Pinto paisagens do litoral com camadas de tinta a óleo e muita luz natural, há dez anos.",
    }
    data.update(overrides)
    return buyer_form(**data)


def image(name="obra.png", data=PNG, kind="image/png"):
    return (name, data, kind)
