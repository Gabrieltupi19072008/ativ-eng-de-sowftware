from datetime import datetime, timedelta

from sqlalchemy import func, select, update

import config
from models import Endereco, Estoque, Pedido
from tests.conftest import OTHER_CPF, buyer_form, image, login

ADDRESS = {"cep": "01001-000", "street": "Praça da Sé", "number": "10", "complement": "", "neighborhood": "Sé", "city": "São Paulo", "state": "SP"}


def order_body(*ids, **overrides) -> dict:
    body = {"items": [str(i) for i in ids], "address": dict(ADDRESS), "paymentMethod": "pix"}
    body.update(overrides)
    return body


def public_ids(client) -> list[str]:
    return [a["id"] for a in client.get("/artworks").json()]


def by_title(client, title: str) -> dict:
    return next(a for a in client.get("/artworks").json() if a["title"] == title)


def second_buyer(client):
    """Cadastra e deixa logado um segundo comprador no mesmo client."""
    client.post("/auth/logout")
    response = client.post("/users", data=buyer_form(email="outra.pessoa@example.com", cpf=OTHER_CPF))
    assert response.status_code == 201, response.text


def stock(db, product_id: int) -> int:
    db.expire_all()
    return db.scalar(select(Estoque.quantidade).where(Estoque.id_produto == product_id))


def test_orders_require_login(client):
    assert client.post("/orders", json=order_body(2)).status_code == 401
    assert client.get("/orders").status_code == 401
    assert client.get("/orders/1").status_code == 401


def test_create_order_reserves_the_artwork_and_computes_total_on_the_server(client, as_, db):
    as_("buyer")
    azul, jardim = by_title(client, "Azul em Movimento"), by_title(client, "Jardim Suspenso")
    # o cliente tenta mandar um total falso: é ignorado, o servidor usa o preço do banco
    response = client.post("/orders", json=order_body(azul["id"], jardim["id"], total=1, price=1))
    assert response.status_code == 201, response.text
    order = response.json()["order"]
    assert order["status"] == "pending" and order["number"] == f"NG-{int(order['id']):06d}"
    assert order["subtotal"] == order["total"] == 2800 + 950 and order["shipping"] == 0
    assert order["deliveryType"] == "shipping" and order["paymentMethod"] == "pix" and order["paymentStatus"] == "pending"
    assert [i["title"] for i in order["items"]] == ["Azul em Movimento", "Jardim Suspenso"]
    assert order["address"]["street"] == "Praça da Sé" and order["address"]["cep"] == "01001-000"
    assert order["canCancel"] is True and order["expiresAt"]
    assert stock(db, int(azul["id"])) == 0 and stock(db, int(jardim["id"])) == 0
    assert azul["id"] not in public_ids(client) and jardim["id"] not in public_ids(client)


def test_sold_artwork_cannot_be_bought_by_someone_else(client, as_):
    as_("buyer")
    art = by_title(client, "Azul em Movimento")
    assert client.post("/orders", json=order_body(art["id"])).status_code == 201
    second_buyer(client)
    response = client.post("/orders", json=order_body(art["id"]))
    assert response.status_code == 409
    assert response.json()["unavailable"] == [art["id"]] and "Azul em Movimento" not in public_ids(client)
    assert client.get("/orders").json() == []  # nenhum pedido vazio ficou para trás


def test_failure_in_one_item_rolls_back_the_whole_order(client, as_, db):
    as_("buyer")
    taken, free = by_title(client, "Azul em Movimento"), by_title(client, "Jardim Suspenso")
    client.post("/orders", json=order_body(taken["id"]))
    second_buyer(client)
    response = client.post("/orders", json=order_body(free["id"], taken["id"]))
    assert response.status_code == 409 and response.json()["unavailable"] == [taken["id"]]
    assert stock(db, int(free["id"])) == 1 and free["id"] in public_ids(client)  # a outra obra não ficou presa
    assert client.get("/orders").json() == []


def test_cannot_buy_own_draft_or_unknown_artworks(client, as_):
    as_("artist")
    own = by_title(client, "Entardecer no Cerrado")
    draft = client.post("/artworks", data={"title": "Rascunho X", "technique": "Óleo", "price": "50", "submitType": "draft"}, files=[("images", image())]).json()["artwork"]
    assert client.post("/orders", json=order_body(own["id"])).status_code == 400  # a própria obra
    client.post("/auth/logout")
    as_("buyer")
    assert client.post("/orders", json=order_body(draft["id"])).status_code == 409   # rascunho
    assert client.post("/orders", json=order_body(99999)).status_code == 409        # inexistente


def test_order_payload_validation(client, as_):
    as_("buyer")
    art = by_title(client, "Azul em Movimento")["id"]
    bad = {
        "empty cart": (order_body(), "items"),
        "non numeric id": (order_body("abc"), "items"),
        "too many": (order_body(*range(1, config.MAX_ORDER_ITEMS + 2)), "items"),
        "bad cep": (order_body(art, address={**ADDRESS, "cep": "123"}), "cep"),
        "missing number": (order_body(art, address={**ADDRESS, "number": " "}), "number"),
        "bad state": (order_body(art, address={**ADDRESS, "state": "S1"}), "state"),
        "missing street": (order_body(art, address={**ADDRESS, "street": ""}), "street"),
    }
    for name, (body, field) in bad.items():
        response = client.post("/orders", json=body)
        assert response.status_code == 400 and response.json()["field"] == field, (name, response.text)
    for body in (order_body(art, paymentMethod="dinheiro"), order_body(art, deliveryType="pickup")):
        assert client.post("/orders", json=body).status_code == 422
    assert public_ids(client).count(art) == 1  # nada foi reservado nas tentativas inválidas


def test_repeated_ids_count_once(client, as_):
    as_("buyer")
    art = by_title(client, "Azul em Movimento")["id"]
    order = client.post("/orders", json=order_body(art, art)).json()["order"]
    assert len(order["items"]) == 1 and order["total"] == 2800


def test_same_address_is_reused_between_orders(client, as_, db):
    as_("buyer")
    client.post("/orders", json=order_body(by_title(client, "Azul em Movimento")["id"]))
    client.post("/orders", json=order_body(by_title(client, "Jardim Suspenso")["id"]))
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Endereco).where(Endereco.cidade == "São Paulo", Endereco.logradouro == "Praça da Sé")) == 1


def test_owner_sees_reserved_then_sold_while_public_does_not(client, as_):
    as_("buyer")
    art = by_title(client, "Entardecer no Cerrado")  # obra da artista de teste
    order = client.post("/orders", json=order_body(art["id"])).json()["order"]
    client.post("/auth/logout")
    as_("artist")
    assert next(a for a in client.get("/artworks").json() if a["id"] == art["id"])["status"] == "reserved"
    client.post("/auth/logout")
    as_("buyer")
    assert client.post(f"/orders/{order['id']}/simulate-payment").status_code == 200
    client.post("/auth/logout")
    as_("artist")
    assert next(a for a in client.get("/artworks").json() if a["id"] == art["id"])["status"] == "sold"
    client.post("/auth/logout")
    assert art["id"] not in public_ids(client)


def test_cancel_returns_the_artwork_to_the_showcase(client, as_, db):
    as_("buyer")
    art = by_title(client, "Azul em Movimento")
    order = client.post("/orders", json=order_body(art["id"])).json()["order"]
    response = client.post(f"/orders/{order['id']}/cancel")
    assert response.status_code == 200 and response.json()["order"]["status"] == "cancelled"
    assert response.json()["order"]["canCancel"] is False and response.json()["order"]["expiresAt"] is None
    assert stock(db, int(art["id"])) == 1 and art["id"] in public_ids(client)
    assert client.post(f"/orders/{order['id']}/cancel").status_code == 409
    assert stock(db, int(art["id"])) == 1  # cancelar de novo não devolve estoque em dobro
    second_buyer(client)
    assert client.post("/orders", json=order_body(art["id"])).status_code == 201  # e outra pessoa já pode comprar


def test_unpaid_orders_expire_and_release_the_artwork(client, as_, db):
    as_("buyer")
    art = by_title(client, "Azul em Movimento")
    order = client.post("/orders", json=order_body(art["id"])).json()["order"]
    db.execute(update(Pedido).where(Pedido.id_pedido == int(order["id"])).values(data_expiracao=datetime.now() - timedelta(minutes=1)))
    db.commit()
    client.post("/auth/logout")
    assert art["id"] in public_ids(client)                       # a vitrine já libera a obra
    assert stock(db, int(art["id"])) == 1
    login(client, "buyer")
    assert client.get(f"/orders/{order['id']}").json()["status"] == "cancelled"
    client.get("/artworks"); client.get("/orders")               # rodar de novo não devolve estoque em dobro
    assert stock(db, int(art["id"])) == 1
    assert client.post(f"/orders/{order['id']}/simulate-payment").status_code == 409  # pedido vencido não pode ser pago


def test_paid_orders_do_not_expire_or_cancel(client, as_, db):
    as_("buyer")
    art = by_title(client, "Azul em Movimento")
    order = client.post("/orders", json=order_body(art["id"], paymentMethod="credit")).json()["order"]
    paid = client.post(f"/orders/{order['id']}/simulate-payment").json()["order"]
    assert paid["status"] == "paid" and paid["paymentStatus"] == "approved" and paid["paymentMethod"] == "credit"
    assert paid["canCancel"] is False and paid["canSimulatePayment"] is False
    db.execute(update(Pedido).where(Pedido.id_pedido == int(order["id"])).values(data_expiracao=datetime.now() - timedelta(days=3)))
    db.commit()
    client.get("/artworks")
    assert client.get(f"/orders/{order['id']}").json()["status"] == "paid" and stock(db, int(art["id"])) == 0
    assert client.post(f"/orders/{order['id']}/cancel").status_code == 409
    assert client.post(f"/orders/{order['id']}/simulate-payment").status_code == 409


def test_fake_payment_is_off_when_disabled(client, as_, monkeypatch):
    as_("buyer")
    monkeypatch.setattr(config, "FAKE_PAYMENTS", False)
    order = client.post("/orders", json=order_body(by_title(client, "Azul em Movimento")["id"])).json()["order"]
    assert order["canSimulatePayment"] is False
    assert client.post(f"/orders/{order['id']}/simulate-payment").status_code == 404


def test_fake_payment_can_never_be_on_in_production(monkeypatch):
    import importlib
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("FAKE_PAYMENTS", "true")
    reloaded = importlib.reload(config)
    try:
        assert reloaded.FAKE_PAYMENTS is False
    finally:
        monkeypatch.undo()
        importlib.reload(config)


def test_my_orders_lists_only_mine_newest_first(client, as_):
    as_("buyer")
    first = client.post("/orders", json=order_body(by_title(client, "Azul em Movimento")["id"])).json()["order"]
    second = client.post("/orders", json=order_body(by_title(client, "Jardim Suspenso")["id"])).json()["order"]
    assert [o["id"] for o in client.get("/orders").json()] == [second["id"], first["id"]]
    second_buyer(client)
    assert client.get("/orders").json() == []


def test_other_users_cannot_see_or_touch_an_order_but_admin_can_see_it(client, as_):
    as_("buyer")
    order = client.post("/orders", json=order_body(by_title(client, "Azul em Movimento")["id"])).json()["order"]
    second_buyer(client)
    for call in (lambda: client.get(f"/orders/{order['id']}"), lambda: client.post(f"/orders/{order['id']}/cancel"),
                 lambda: client.post(f"/orders/{order['id']}/simulate-payment")):
        assert call().status_code == 404
    client.post("/auth/logout")
    as_("admin")
    assert client.get(f"/orders/{order['id']}").status_code == 200
    assert client.get("/orders/99999").status_code == 404
