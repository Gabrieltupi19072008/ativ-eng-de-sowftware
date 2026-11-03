from tests.test_orders import by_title, order_body


def paid_order(client, as_, *titles: str, pay: bool = True) -> dict:
    as_("buyer")
    ids = [by_title(client, t)["id"] for t in titles]
    order = client.post("/orders", json=order_body(*ids)).json()["order"]
    if pay:
        order = client.post(f"/orders/{order['id']}/simulate-payment").json()["order"]
    client.post("/auth/logout")
    return order


def ship(client, order_id, code="AA123456789BR", **extra):
    return client.post(f"/orders/{order_id}/ship", json={"trackingCode": code, **extra})


def test_ship_and_deliver_require_login_and_a_seller(client, as_):
    order = paid_order(client, as_, "Entardecer no Cerrado")
    assert ship(client, order["id"]).status_code == 401
    assert client.post(f"/orders/{order['id']}/deliver").status_code == 401
    as_("buyer")  # comprador não é vendedor: nem fica sabendo que o pedido pode ser enviado
    assert ship(client, order["id"]).status_code == 404


def test_artist_ships_then_delivers_own_order(client, as_):
    order = paid_order(client, as_, "Entardecer no Cerrado")
    as_("artist")
    sale = client.get("/sales").json()[0]
    assert sale["canShip"] is True and sale["canDeliver"] is False and sale["shipment"] is None
    assert sale["shippingAddress"]["street"] == "Praça da Sé" and sale["shippingAddress"]["cep"] == "01001-000"

    response = ship(client, order["id"], " aa123456789br ", carrier="Correios")
    assert response.status_code == 200, response.text
    shipped = response.json()["order"]
    assert shipped["status"] == "shipped"
    assert shipped["shipment"]["trackingCode"] == "AA123456789BR" and shipped["shipment"]["carrier"] == "Correios"
    assert shipped["shipment"]["shippedAt"] and shipped["shipment"]["deliveredAt"] is None

    assert ship(client, order["id"], "BB123456789BR").status_code == 409  # não envia duas vezes
    sale = client.get("/sales").json()[0]
    assert sale["canShip"] is False and sale["canDeliver"] is True

    delivered = client.post(f"/orders/{order['id']}/deliver").json()["order"]
    assert delivered["status"] == "delivered" and delivered["shipment"]["deliveredAt"]
    assert client.post(f"/orders/{order['id']}/deliver").status_code == 409

    client.post("/auth/logout")
    as_("buyer")  # o comprador acompanha o rastreio em "Meus pedidos"
    mine = client.get("/orders").json()[0]
    assert mine["status"] == "delivered" and mine["shipment"]["trackingCode"] == "AA123456789BR"


def test_cannot_ship_unpaid_or_deliver_unshipped(client, as_):
    unpaid = paid_order(client, as_, "Entardecer no Cerrado", pay=False)
    as_("artist")
    assert ship(client, unpaid["id"]).status_code == 409
    sale = client.get("/sales").json()[0]
    assert sale["shippingAddress"] is None  # sem pagamento, o endereço não é liberado
    assert client.post(f"/orders/{unpaid['id']}/deliver").status_code == 409


def test_tracking_code_validation(client, as_):
    first = paid_order(client, as_, "Entardecer no Cerrado")
    as_("artist")
    for bad in ("", "abc", "AA 123 456", "AA-123456789"):
        response = ship(client, first["id"], bad)
        assert response.status_code == 400 and response.json()["field"] == "trackingCode", bad
    assert ship(client, first["id"]).status_code == 200
    client.post("/auth/logout")
    # o mesmo código não pode ser reaproveitado em outro pedido
    second = paid_order(client, as_, "Azul em Movimento")
    as_("admin")
    duplicate = ship(client, second["id"])
    assert duplicate.status_code == 409 and duplicate.json()["field"] == "trackingCode"
    assert client.get("/admin/orders").json()[0]["status"] == "paid"  # o pedido não ficou pela metade


def test_artist_cannot_touch_other_artists_orders_but_admin_can(client, as_):
    others = paid_order(client, as_, "Azul em Movimento")                              # de Carlos Neves
    mixed = paid_order(client, as_, "Entardecer no Cerrado", "Jardim Suspenso")       # de duas artistas
    as_("artist")
    assert ship(client, others["id"]).status_code == 404
    assert ship(client, mixed["id"]).status_code == 404
    assert all(not s["canShip"] for s in client.get("/sales").json())
    client.post("/auth/logout")

    as_("admin")
    admin_view = {o["id"]: o for o in client.get("/admin/orders").json()}
    assert admin_view[mixed["id"]]["canShip"] is True
    assert ship(client, mixed["id"]).status_code == 200
    assert client.post(f"/orders/{mixed['id']}/deliver").json()["order"]["status"] == "delivered"
