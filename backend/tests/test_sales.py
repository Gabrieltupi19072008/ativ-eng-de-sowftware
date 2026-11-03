from tests.test_orders import by_title, order_body


def buy(client, as_, title: str, pay: bool = True) -> dict:
    """Comprador compra uma obra (e paga, se pay=True). Devolve o pedido."""
    as_("buyer")
    art = by_title(client, title)
    order = client.post("/orders", json=order_body(art["id"])).json()["order"]
    if pay:
        order = client.post(f"/orders/{order['id']}/simulate-payment").json()["order"]
    client.post("/auth/logout")
    return order


def test_sales_and_reports_require_the_right_role(client, as_):
    assert client.get("/sales").status_code == 401
    assert client.get("/admin/orders").status_code == 401
    assert client.get("/admin/reports").status_code == 401
    as_("buyer")
    assert client.get("/sales").status_code == 403
    assert client.get("/admin/orders").status_code == 403
    assert client.get("/admin/reports").status_code == 403


def test_artist_sees_only_own_sales(client, as_):
    # "Entardecer no Cerrado" é da artista de teste; "Azul em Movimento" é de outra pessoa
    buy(client, as_, "Entardecer no Cerrado")
    buy(client, as_, "Azul em Movimento")
    as_("artist")
    sales = client.get("/sales").json()
    assert [s["title"] for s in sales] == ["Entardecer no Cerrado"]
    assert sales[0]["status"] == "paid" and sales[0]["price"] == 1200
    assert sales[0]["buyerName"] and "email" not in " ".join(sales[0])  # sem dados de contato do comprador


def test_cancelled_orders_are_not_sales_but_reserved_ones_are(client, as_):
    reserved = buy(client, as_, "Entardecer no Cerrado", pay=False)
    as_("artist")
    assert [s["status"] for s in client.get("/sales").json()] == ["pending"]
    client.post("/auth/logout")
    as_("buyer")
    client.post(f"/orders/{reserved['id']}/cancel")
    client.post("/auth/logout")
    as_("artist")
    assert client.get("/sales").json() == []


def test_admin_sees_all_orders_with_buyer(client, as_):
    buy(client, as_, "Entardecer no Cerrado")
    buy(client, as_, "Azul em Movimento", pay=False)
    as_("admin")
    orders = client.get("/admin/orders").json()
    assert len(orders) == 2
    assert {o["status"] for o in orders} == {"paid", "pending"}
    assert all(o["buyerName"] and o["buyerEmail"] == "comprador@nambagalerie.com" for o in orders)
    assert len(client.get("/sales").json()) == 2  # o admin vê as vendas de todos


def test_reports_use_real_numbers(client, as_):
    empty = (as_("admin"), client.get("/admin/reports").json())[1]
    assert empty["revenue"] == 0 and empty["paidOrders"] == 0 and empty["averageTicket"] == 0 and empty["topArtists"] == []
    assert empty["catalog"]["onSale"] == 6
    client.post("/auth/logout")

    buy(client, as_, "Entardecer no Cerrado")            # 1200, paga
    buy(client, as_, "Azul em Movimento")                # 2800, paga
    buy(client, as_, "Jardim Suspenso", pay=False)       # reservada: ainda não é receita
    as_("admin")
    report = client.get("/admin/reports").json()
    assert report["revenue"] == 4000 and report["paidOrders"] == 2 and report["averageTicket"] == 2000
    assert report["ordersByStatus"]["paid"] == 2 and report["ordersByStatus"]["pending"] == 1
    assert report["catalog"] == {"onSale": 3, "outOfStock": 3, "drafts": 0}
    assert report["topArtists"][0] == {"name": "Carlos Neves", "sold": 1, "revenue": 2800}
    assert {t["technique"] for t in report["salesByTechnique"]} == {"Acrílica", "Óleo"}
