from tests.test_orders import ADDRESS, by_title, order_body

PROFILE = {"name": "Camila Prado Souza", "phone": "(11) 98888-7777", "city": "Campinas", "state": "sp", "bio": ""}
OTHER_ADDRESS = {**ADDRESS, "cep": "20040-020", "street": "Rua da Assembleia", "number": "5", "neighborhood": "Centro", "city": "Rio de Janeiro", "state": "RJ"}


def test_account_routes_require_login(client):
    assert client.patch("/me", json=PROFILE).status_code == 401
    assert client.post("/me/password", json={"currentPassword": "a", "newPassword": "b"}).status_code == 401
    assert client.get("/me/addresses").status_code == 401
    assert client.post("/me/addresses", json=ADDRESS).status_code == 401


def test_update_profile(client, as_):
    as_("buyer")
    response = client.patch("/me", json=PROFILE)
    assert response.status_code == 200, response.text
    user = response.json()["user"]
    assert user["name"] == "Camila Prado Souza" and user["phone"] == "11988887777" and user["city"] == "Campinas" and user["state"] == "SP"
    assert client.get("/me").json()["name"] == "Camila Prado Souza"
    for field, bad in (("name", "ab"), ("phone", "123"), ("state", "S1")):
        response = client.patch("/me", json={**PROFILE, field: bad})
        assert response.status_code == 400 and response.json()["field"] == field, field


def test_artist_must_keep_a_proper_bio(client, as_):
    as_("artist")
    assert client.patch("/me", json={**PROFILE, "bio": "curta demais"}).json()["field"] == "bio"
    bio = "Pesquiso a luz do cerrado em camadas de tinta acrílica, com cores quentes e gesto livre, há dez anos."
    response = client.patch("/me", json={**PROFILE, "bio": bio})
    assert response.status_code == 200 and response.json()["user"]["bio"] == bio


def test_change_password(client, as_):
    as_("buyer")
    wrong = client.post("/me/password", json={"currentPassword": "errada", "newPassword": "nova-senha-123"})
    assert wrong.status_code == 400 and wrong.json()["field"] == "currentPassword"
    same = client.post("/me/password", json={"currentPassword": "comprador@123", "newPassword": "comprador@123"})
    assert same.status_code == 400 and same.json()["field"] == "newPassword"
    short = client.post("/me/password", json={"currentPassword": "comprador@123", "newPassword": "curta"})
    assert short.status_code == 400 and short.json()["field"] == "newPassword"
    assert client.post("/me/password", json={"currentPassword": "comprador@123", "newPassword": "nova-senha-123"}).status_code == 200

    client.post("/auth/logout")
    assert client.post("/auth/login", json={"email": "comprador@nambagalerie.com", "password": "comprador@123"}).status_code == 401
    assert client.post("/auth/login", json={"email": "comprador@nambagalerie.com", "password": "nova-senha-123"}).status_code == 200


def test_wrong_current_password_is_rate_limited(client, as_):
    as_("buyer")
    for _ in range(5):
        assert client.post("/me/password", json={"currentPassword": "x", "newPassword": "nova-senha-123"}).status_code == 400
    blocked = client.post("/me/password", json={"currentPassword": "comprador@123", "newPassword": "nova-senha-123"})
    assert blocked.status_code == 429  # nem a senha certa passa enquanto estiver bloqueado


def test_address_book(client, as_):
    as_("buyer")
    assert client.get("/me/addresses").json() == []
    first = client.post("/me/addresses", json=ADDRESS)
    assert first.status_code == 201, first.text
    first_id = first.json()["address"]["id"]
    second_id = client.post("/me/addresses", json=OTHER_ADDRESS).json()["address"]["id"]
    assert [a["street"] for a in client.get("/me/addresses").json()] == ["Praça da Sé", "Rua da Assembleia"]
    assert client.get("/me").json()["address"]["id"] == first_id  # o primeiro é o sugerido no checkout

    edited = client.patch(f"/me/addresses/{second_id}", json={**OTHER_ADDRESS, "number": "99"})
    assert edited.status_code == 200 and edited.json()["address"]["id"] == second_id and edited.json()["address"]["number"] == "99"  # sem pedido: edita no lugar
    assert client.post("/me/addresses", json={**ADDRESS, "cep": "123"}).json()["field"] == "cep"

    assert client.delete(f"/me/addresses/{first_id}").status_code == 200
    assert [a["id"] for a in client.get("/me/addresses").json()] == [second_id]
    assert client.get("/me").json()["address"]["id"] == second_id
    assert client.delete(f"/me/addresses/{first_id}").status_code == 404


def test_address_of_someone_else_is_invisible(client, as_):
    as_("buyer")
    mine = client.post("/me/addresses", json=ADDRESS).json()["address"]["id"]
    client.post("/auth/logout")
    as_("artist")
    assert client.patch(f"/me/addresses/{mine}", json=OTHER_ADDRESS).status_code == 404
    assert client.delete(f"/me/addresses/{mine}").status_code == 404
    assert client.get("/me/addresses").json() == []


def test_editing_an_address_used_by_an_order_keeps_the_order_intact(client, as_):
    as_("buyer")
    order = client.post("/orders", json=order_body(by_title(client, "Azul em Movimento")["id"])).json()["order"]
    address_id = client.get("/me/addresses").json()[0]["id"]  # criado pelo checkout
    edited = client.patch(f"/me/addresses/{address_id}", json={**ADDRESS, "number": "777"}).json()["address"]
    assert edited["id"] != address_id and edited["number"] == "777"          # virou um endereço novo
    assert [a["number"] for a in client.get("/me/addresses").json()] == ["777"]  # o antigo saiu da conta
    assert client.get("/orders").json()[0]["address"]["number"] == ADDRESS["number"]  # e o pedido segue com o endereço original
    assert order["address"]["street"] == "Praça da Sé"

    assert client.delete(f"/me/addresses/{edited['id']}").status_code == 200
    again = client.post("/orders", json=order_body(by_title(client, "Jardim Suspenso")["id"]))
    assert again.status_code == 201  # excluir da conta não atrapalha comprar de novo com o mesmo endereço


def test_address_limit(client, as_):
    as_("buyer")
    for number in range(10):
        assert client.post("/me/addresses", json={**ADDRESS, "number": str(number)}).status_code == 201
    assert client.post("/me/addresses", json={**ADDRESS, "number": "99"}).status_code == 400
