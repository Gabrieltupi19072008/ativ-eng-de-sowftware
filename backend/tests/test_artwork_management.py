from tests.test_artworks import artwork_form
from tests.test_orders import by_title, order_body
from tests.conftest import image


def new_artwork(client, **overrides) -> dict:
    return client.post("/artworks", data=artwork_form(**overrides), files=[("images", image())]).json()["artwork"]


def edit_body(**overrides) -> dict:
    body = {"title": "Maré Calma", "technique": "Aquarela", "description": "Nova descrição.", "price": "1.500,50", "width": "70", "height": "90", "year": "2024", "submitType": "publish"}
    body.update(overrides)
    return body


def test_artist_edits_own_artwork(client, as_):
    as_("artist")
    art = new_artwork(client)
    response = client.patch(f"/artworks/{art['id']}", json=edit_body())
    assert response.status_code == 200, response.text
    updated = response.json()["artwork"]
    assert updated["title"] == "Maré Calma" and updated["technique"] == "Aquarela" and updated["price"] == 1500.5
    assert updated["width"] == 70 and updated["year"] == 2024 and updated["status"] == "published"
    assert by_title(client, "Maré Calma")["price"] == 1500.5

    draft = client.patch(f"/artworks/{art['id']}", json=edit_body(submitType="draft")).json()["artwork"]
    assert draft["status"] == "draft"
    client.post("/auth/logout")
    assert "Maré Calma" not in [a["title"] for a in client.get("/artworks").json()]  # rascunho some da vitrine


def test_edit_validates_and_checks_ownership(client, as_):
    as_("artist")
    art = new_artwork(client)
    for field, bad in (("title", "ab"), ("technique", "Escultura"), ("price", "zero"), ("year", "20x5")):
        response = client.patch(f"/artworks/{art['id']}", json=edit_body(**{field: bad}))
        assert response.status_code == 400 and response.json()["field"] == field, field
    client.post("/auth/logout")
    assert client.patch(f"/artworks/{art['id']}", json=edit_body()).status_code == 401
    as_("buyer")
    assert client.patch(f"/artworks/{art['id']}", json=edit_body()).status_code == 404
    other = by_title(client, "Azul em Movimento")  # obra de outro artista
    client.post("/auth/logout")
    as_("artist")
    assert client.patch(f"/artworks/{other['id']}", json=edit_body()).status_code == 404
    assert client.delete(f"/artworks/{other['id']}").status_code == 404


def test_reserved_or_sold_artwork_cannot_be_changed(client, as_):
    as_("buyer")
    art = by_title(client, "Entardecer no Cerrado")
    order = client.post("/orders", json=order_body(art["id"])).json()["order"]
    client.post("/auth/logout")
    as_("artist")
    assert client.patch(f"/artworks/{art['id']}", json=edit_body()).status_code == 409
    assert client.delete(f"/artworks/{art['id']}").status_code == 409
    client.post("/auth/logout")
    as_("buyer")
    client.post(f"/orders/{order['id']}/cancel")  # a obra volta à vitrine e pode ser editada de novo
    client.post("/auth/logout")
    as_("artist")
    assert client.patch(f"/artworks/{art['id']}", json=edit_body()).status_code == 200


def test_delete_removes_artwork_and_its_files_only_without_order_history(client, as_, db):
    as_("artist")
    art = new_artwork(client)
    assert client.delete(f"/artworks/{art['id']}").status_code == 200
    assert art["id"] not in [a["id"] for a in client.get("/artworks").json()]
    assert client.delete(f"/artworks/{art['id']}").status_code == 404

    # obra que já apareceu em um pedido (mesmo cancelado) não pode ser excluída: o histórico depende dela
    used = by_title(client, "Entardecer no Cerrado")
    client.post("/auth/logout")
    as_("buyer")
    order = client.post("/orders", json=order_body(used["id"])).json()["order"]
    client.post(f"/orders/{order['id']}/cancel")
    client.post("/auth/logout")
    as_("artist")
    response = client.delete(f"/artworks/{used['id']}")
    assert response.status_code == 409 and "rascunho" in response.json()["message"]
    assert client.patch(f"/artworks/{used['id']}", json=edit_body(submitType="draft")).status_code == 200  # o caminho alternativo


def test_admin_unpublishes_and_republishes(client, as_):
    art = by_title(client, "Azul em Movimento")
    assert client.patch(f"/artworks/{art['id']}/visibility", json={"visible": False}).status_code == 401
    as_("artist")
    assert client.patch(f"/artworks/{art['id']}/visibility", json={"visible": False}).status_code == 403
    client.post("/auth/logout")
    as_("admin")
    response = client.patch(f"/artworks/{art['id']}/visibility", json={"visible": False})
    assert response.status_code == 200 and response.json()["artwork"]["status"] == "hidden"
    assert client.patch("/artworks/99999/visibility", json={"visible": False}).status_code == 404
    client.post("/auth/logout")

    assert art["id"] not in [a["id"] for a in client.get("/artworks").json()]  # fora da vitrine pública
    as_("buyer")
    assert client.post("/orders", json=order_body(art["id"])).status_code == 409  # e não dá para comprar
    client.post("/auth/logout")
    as_("admin")
    assert client.patch(f"/artworks/{art['id']}/visibility", json={"visible": True}).json()["artwork"]["status"] == "published"
    assert art["id"] in [a["id"] for a in client.get("/artworks").json()]


def test_artist_cannot_undo_a_takedown(client, as_):
    mine = by_title(client, "Entardecer no Cerrado")
    as_("admin")
    client.patch(f"/artworks/{mine['id']}/visibility", json={"visible": False})
    client.post("/auth/logout")
    as_("artist")
    assert next(a for a in client.get("/artworks").json() if a["id"] == mine["id"])["status"] == "hidden"  # o artista vê o aviso
    assert client.patch(f"/artworks/{mine['id']}", json=edit_body()).status_code == 403
