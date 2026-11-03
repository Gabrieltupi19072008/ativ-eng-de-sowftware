import re
from datetime import datetime, timedelta

import pytest
from sqlalchemy import update

import mailer
from models import RedefinicaoSenha
from routers import auth

EMAIL = "comprador@nambagalerie.com"


@pytest.fixture(autouse=True)
def fresh_limiter():
    auth.forgot_limiter.clear_all()


@pytest.fixture
def outbox(monkeypatch):
    """Captura os e-mails em vez de enviar. O envio roda em segundo plano, mas o TestClient espera por ele."""
    sent: list[dict] = []
    monkeypatch.setattr(auth, "send_mail", lambda to, subject, body: sent.append({"to": to, "subject": subject, "body": body}))
    return sent


def token_from(mail: dict) -> str:
    return re.search(r"\?reset=([\w-]+)", mail["body"]).group(1)


def test_forgot_password_answers_the_same_for_unknown_emails(client, outbox):
    known = client.post("/auth/forgot-password", json={"email": EMAIL})
    unknown = client.post("/auth/forgot-password", json={"email": "ninguem@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(outbox) == 1 and outbox[0]["to"] == EMAIL  # e-mail só sai para quem existe


def test_reset_password_flow(client, outbox):
    client.post("/auth/forgot-password", json={"email": EMAIL.upper()})
    token = token_from(outbox[0])
    assert "http://localhost:5173/" in outbox[0]["body"]

    assert client.post("/auth/reset-password", json={"token": token, "newPassword": "curta"}).json()["field"] == "newPassword"
    done = client.post("/auth/reset-password", json={"token": token, "newPassword": "senha-nova-123"})
    assert done.status_code == 200, done.text
    assert client.post("/auth/login", json={"email": EMAIL, "password": "comprador@123"}).status_code == 401
    assert client.post("/auth/login", json={"email": EMAIL, "password": "senha-nova-123"}).status_code == 200
    # o link só vale uma vez
    again = client.post("/auth/reset-password", json={"token": token, "newPassword": "outra-senha-456"})
    assert again.status_code == 400 and again.json()["field"] == "token"


def test_invalid_expired_and_replaced_links_are_refused(client, outbox, db):
    assert client.post("/auth/reset-password", json={"token": "inventado", "newPassword": "senha-nova-123"}).status_code == 400

    client.post("/auth/forgot-password", json={"email": EMAIL})
    first = token_from(outbox[0])
    client.post("/auth/forgot-password", json={"email": EMAIL})
    second = token_from(outbox[1])
    assert client.post("/auth/reset-password", json={"token": first, "newPassword": "senha-nova-123"}).status_code == 400  # o link mais novo substitui o antigo

    db.execute(update(RedefinicaoSenha).values(data_expiracao=datetime.now() - timedelta(minutes=1)))
    db.commit()
    assert client.post("/auth/reset-password", json={"token": second, "newPassword": "senha-nova-123"}).status_code == 400  # expirado
    assert client.post("/auth/login", json={"email": EMAIL, "password": "comprador@123"}).status_code == 200  # a senha nunca mudou


def test_token_is_stored_only_as_a_hash(client, outbox, db):
    client.post("/auth/forgot-password", json={"email": EMAIL})
    token = token_from(outbox[0])
    stored = db.query(RedefinicaoSenha).one()
    assert token not in stored.token_hash and len(stored.token_hash) == 64


def test_forgot_password_is_rate_limited(client, outbox):
    for _ in range(5):
        assert client.post("/auth/forgot-password", json={"email": EMAIL}).status_code == 200
    assert client.post("/auth/forgot-password", json={"email": EMAIL}).status_code == 429
    assert len(outbox) == 5


def test_mailer_without_smtp_only_logs(caplog):
    with caplog.at_level("WARNING", logger="uvicorn.error"):
        mailer.send_mail("a@example.com", "Assunto", "Corpo do e-mail")
    assert "Corpo do e-mail" in caplog.text
