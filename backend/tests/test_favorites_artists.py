from tests.conftest import OTHER_CPF, buyer_form
from tests.test_orders import by_title, order_body


def test_favorites_require_login(client):
    assert client.get("/favorites").status_code == 401
    assert client.post("/favorites/1").status_code == 401
    assert client.delete("/favorites/1").status_code == 401


def test_favorites_are_saved_per_person(client, as_):
    as_("buyer")
    art, other = by_title(client, "Azul em Movimento")["id"], by_title(client, "Jardim Suspenso")["id"]
    assert client.get("/favorites").json() == []
    assert client.post(f"/favorites/{art}").status_code == 200
    assert client.post(f"/favorites/{art}").status_code == 200  # repetir não duplica nem dá erro
    client.post(f"/favorites/{other}")
    assert client.get("/favorites").json() == [other, art]  # o mais novo primeiro
    assert client.delete(f"/favorites/{art}").status_code == 200
    assert client.get("/favorites").json() == [other]

    client.post("/auth/logout")
    client.post("/users", data=buyer_form(email="outra.pessoa@example.com", cpf=OTHER_CPF))
    assert client.get("/favorites").json() == []  # cada pessoa tem a sua lista


def test_cannot_favorite_unknown_or_hidden_artworks(client, as_):
    as_("admin")
    hidden = by_title(client, "Azul em Movimento")["id"]
    client.patch(f"/artworks/{hidden}/visibility", json={"visible": False})
    client.post("/auth/logout")
    as_("buyer")
    assert client.post("/favorites/99999").status_code == 404
    assert client.post(f"/favorites/{hidden}").status_code == 404


def test_public_artists_list_has_only_public_data(client, as_):
    response = client.get("/artists/public")  # sem login
    assert response.status_code == 200
    artists = response.json()
    assert len(artists) == 6 and {a["name"] for a in artists} >= {"Mariana Luz", "Carlos Neves"}
    assert all(set(a) == {"id", "name", "city", "state", "artStyle", "bio", "works", "cover"} for a in artists)  # nada de e-mail ou CPF
    assert all(a["works"] == 1 and a["cover"].startswith("http") for a in artists)
    assert "isabela" not in " ".join(a["name"].lower() for a in artists)  # artista pendente não aparece


def test_public_artists_follow_the_stock(client, as_):
    as_("buyer")
    client.post("/orders", json=order_body(by_title(client, "Azul em Movimento")["id"]))  # reservada: sai da vitrine
    names = [a["name"] for a in client.get("/artists/public").json()]
    assert "Carlos Neves" not in names and len(names) == 5


def test_birth_date_is_saved_and_validated(client, as_):
    response = client.post("/users", data=buyer_form(birthDate="1990-05-17"))
    assert response.status_code == 201 and response.json()["user"]["birthDate"] == "1990-05-17"
    assert client.patch("/me", json={"name": "Joana Silva", "birthDate": "1991-01-02"}).json()["user"]["birthDate"] == "1991-01-02"
    assert client.patch("/me", json={"name": "Joana Silva", "birthDate": ""}).json()["user"]["birthDate"] == ""  # pode apagar
    for bad in ("2999-01-01", "1800-01-01", "17/05/1990", "nada"):
        response = client.patch("/me", json={"name": "Joana Silva", "birthDate": bad})
        assert response.status_code == 400 and response.json()["field"] == "birthDate", bad
    client.post("/auth/logout")
    assert client.post("/users", data=buyer_form(email="x@example.com", cpf=OTHER_CPF, birthDate="2999-01-01")).json()["field"] == "birthDate"
