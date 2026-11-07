from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select

import config
from models import Cliente
from tests.conftest import ACCOUNTS, JPG, OTHER_CPF, PNG, VALID_CPF, artist_form, buyer_form, image, login


def test_login_ok_sets_http_only_cookie_and_returns_user(client):
    response = login(client, "buyer")
    body = response.json()
    assert body["ok"] is True
    assert body["user"]["role"] == "buyer" and body["user"]["artistStatus"] == "not-applicable"
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert "senha_hash" not in response.text and "password" not in body["user"]


def test_me_requires_login_and_returns_current_user(client, as_):
    assert client.get("/me").status_code == 401
    as_("artist")
    me = client.get("/me").json()
    assert me["email"] == "comerciante@nambagalerie.com" and me["artistStatus"] == "approved"


def test_logout_clears_session(client, as_):
    as_("buyer")
    assert client.post("/auth/logout").json()["ok"] is True
    assert client.get("/me").status_code == 401


def test_wrong_password_and_unknown_email_get_same_answer(client):
    wrong = client.post("/auth/login", json={"email": "comprador@nambagalerie.com", "password": "errada-errada"})
    unknown = client.post("/auth/login", json={"email": "ninguem@example.com", "password": "errada-errada"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"ok": False, "message": "E-mail ou senha inválidos."}


def test_email_is_case_insensitive(client):
    response = client.post("/auth/login", json={"email": " COMPRADOR@NambaGalerie.com ", "password": "comprador@123"})
    assert response.status_code == 200


def test_inactive_user_cannot_login(client, db):
    db.scalar(select(Cliente).where(Cliente.email == "comprador@nambagalerie.com")).ativo = "N"
    db.commit()
    response = client.post("/auth/login", json=dict(zip(("email", "password"), ACCOUNTS["buyer"])))
    assert response.status_code == 401


def test_login_blocked_after_too_many_failures(client):
    for _ in range(5):
        assert client.post("/auth/login", json={"email": "comprador@nambagalerie.com", "password": "errada-errada"}).status_code == 401
    blocked = client.post("/auth/login", json=dict(zip(("email", "password"), ACCOUNTS["buyer"])))
    assert blocked.status_code == 429


def test_login_with_missing_fields_is_validation_error(client):
    response = client.post("/auth/login", json={"email": "a@b.com"})
    assert response.status_code == 422 and response.json()["ok"] is False and response.json()["field"] == "password"


def test_garbage_and_expired_tokens_are_rejected(client):
    client.cookies.set(config.COOKIE_NAME, "isto-nao-e-um-token")
    assert client.get("/me").status_code == 401
    expired = jwt.encode({"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, config.jwt_secret(), algorithm="HS256")
    client.cookies.set(config.COOKIE_NAME, expired)
    assert client.get("/me").status_code == 401
    forged = jwt.encode({"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, "outro-segredo-qualquer-com-32-caracteres", algorithm="HS256")
    client.cookies.set(config.COOKIE_NAME, forged)
    assert client.get("/me").status_code == 401


def test_register_buyer_logs_in_and_saves_address(client, db):
    response = client.post("/users", data=buyer_form())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["role"] == "buyer" and body["user"]["address"]["street"] == "Praça da Sé"
    assert body["user"]["address"]["cep"] == "01001-000"
    assert client.get("/me").json()["email"] == "joana@example.com"
    saved = db.scalar(select(Cliente).where(Cliente.email == "joana@example.com"))
    assert saved.senha_hash.startswith("$argon2") and saved.cpf == "52998224725"


def test_register_saves_phone_digits_and_rejects_bad_phone(client, db):
    assert client.post("/users", data=buyer_form(phone="(11) 99999-9999")).status_code == 201
    assert db.scalar(select(Cliente).where(Cliente.email == "joana@example.com")).telefone == "11999999999"
    client.post("/auth/logout")
    response = client.post("/users", data=buyer_form(email="x@example.com", cpf=OTHER_CPF, phone="123"))
    assert response.status_code == 400 and response.json()["field"] == "phone"


def test_register_without_address_is_allowed(client):
    form = buyer_form(cep="", street="", number="", neighborhood="", city="", state="")
    response = client.post("/users", data=form)
    assert response.status_code == 201 and "address" not in response.json()["user"]


def test_register_with_incomplete_address_names_the_field(client):
    response = client.post("/users", data=buyer_form(street=""))
    assert response.status_code == 400 and response.json()["field"] == "street"
    response = client.post("/users", data=buyer_form(cep="123"))
    assert response.json()["field"] == "cep"


def test_register_validations(client):
    cases = [
        (buyer_form(role="admin"), "role"),          # ninguém vira administrador pelo cadastro
        (buyer_form(name="Jo"), "name"),
        (buyer_form(email="sem-arroba"), "email"),
        (buyer_form(password="curta"), "password"),
        (buyer_form(cpf="111.111.111-11"), "cpf"),
        (buyer_form(cpf="529.982.247-26"), "cpf"),
        (buyer_form(state="Sao"), "state"),
    ]
    for form, field in cases:
        response = client.post("/users", data=form)
        assert response.status_code == 400 and response.json()["field"] == field, (field, response.text)


def test_register_cannot_create_admin_or_approved_artist(client, db):
    client.post("/users", data=artist_form(), files=[("portfolio", image()), ("portfolio", image("b.jpg", JPG, "image/jpeg"))])
    artist = db.scalar(select(Cliente).where(Cliente.email == "rafael@example.com"))
    assert artist.papel == "ARTISTA" and artist.status_artista == "PENDENTE"


def test_register_duplicate_email_or_cpf_conflicts(client):
    assert client.post("/users", data=buyer_form()).status_code == 201
    client.post("/auth/logout")
    assert client.post("/users", data=buyer_form(cpf=OTHER_CPF)).status_code == 409   # mesmo e-mail
    assert client.post("/users", data=buyer_form(email="outra@example.com")).status_code == 409  # mesmo CPF
    assert client.post("/users", data=buyer_form(email="JOANA@example.com", cpf=OTHER_CPF)).status_code == 409  # e-mail em maiúsculas


def test_artist_registration_needs_profile_and_2_to_5_valid_images(client, db):
    one = [("portfolio", image())]
    assert client.post("/users", data=artist_form(), files=one).json()["field"] == "portfolio"
    seven = [("portfolio", image(f"{i}.png")) for i in range(6)]
    assert client.post("/users", data=artist_form(), files=seven).json()["field"] == "portfolio"
    fake = [("portfolio", image()), ("portfolio", image("virus.png", b"MZ\x90\x00 nao sou imagem", "image/png"))]
    response = client.post("/users", data=artist_form(), files=fake)
    assert response.status_code == 400 and response.json()["field"] == "portfolio"
    assert client.post("/users", data=artist_form(artStyle=""), files=[("portfolio", image()), ("portfolio", image())]).json()["field"] == "artStyle"
    assert client.post("/users", data=artist_form(artistBio="curta"), files=[("portfolio", image()), ("portfolio", image())]).json()["field"] == "artistBio"
    assert db.scalar(select(Cliente).where(Cliente.email == "rafael@example.com")) is None  # nada foi gravado


def test_artist_registration_ok_is_pending_and_saves_portfolio(client, db):
    files = [("portfolio", image("a.png")), ("portfolio", image("b.jpg", JPG, "image/jpeg"))]
    response = client.post("/users", data=artist_form(), files=files)
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["role"] == "artist" and user["artistStatus"] == "pending"
    assert "48h" in response.json()["message"]
    artist = db.scalar(select(Cliente).where(Cliente.email == "rafael@example.com"))
    assert [i.url.rsplit(".", 1)[1] for i in artist.portfolio] == ["png", "jpg"]
    fetched = client.get(artist.portfolio[0].url)
    assert fetched.status_code == 200 and fetched.content == PNG


def test_origin_check_blocks_foreign_sites_but_allows_the_front_end(client):
    body = {"email": "comprador@nambagalerie.com", "password": "comprador@123"}
    assert client.post("/auth/login", json=body, headers={"Origin": "http://site-malicioso.com"}).status_code == 403
    assert client.post("/auth/login", json=body, headers={"Origin": "http://localhost:5173"}).status_code == 200


def test_cors_allows_front_end_with_credentials(client):
    response = client.options("/me", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
    other = client.options("/me", headers={"Origin": "http://site-malicioso.com", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in other.headers


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.head("/health").status_code == 200
