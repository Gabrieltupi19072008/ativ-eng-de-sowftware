from sqlalchemy import select

from models import Cliente


def test_only_admin_can_list_candidates(client, as_):
    assert client.get("/artists").status_code == 401
    as_("buyer")
    assert client.get("/artists").status_code == 403
    client.post("/auth/logout")
    as_("artist")
    assert client.get("/artists").status_code == 403


def test_admin_lists_pending_candidates_in_front_format(client, as_):
    as_("admin")
    candidates = client.get("/artists").json()
    assert [c["name"] for c in candidates] == ["Isabela Monteiro", "Diego Cavalcante"]
    first = candidates[0]
    assert {"id", "name", "email", "city", "state", "artStyle", "artistBio", "createdAt", "portfolio"} <= set(first)
    assert len(first["portfolio"]) == 3 and first["state"] == "MG"
    assert "senha_hash" not in str(first)
    approved = client.get("/artists", params={"status": "approved"}).json()
    assert len(approved) == 6 and all(a["status"] == "approved" for a in approved)
    assert client.get("/artists", params={"status": "qualquer"}).status_code == 422


def test_admin_approves_and_artist_can_then_publish(client, as_, db):
    admin_client = as_("admin")
    candidate = admin_client.get("/artists").json()[0]
    response = client.patch(f"/artists/{candidate['id']}", json={"decision": "approved", "note": "Portfólio excelente."})
    assert response.status_code == 200 and response.json()["message"] == "Artista aprovado para vender."
    artist = db.scalar(select(Cliente).where(Cliente.email == "isabela@galerie.demo"))
    admin = db.scalar(select(Cliente).where(Cliente.email == "admin@nambagalerie.com"))
    assert artist.status_artista == "APROVADO" and artist.id_revisor == admin.id_cliente
    assert artist.observacao_revisao == "Portfólio excelente." and artist.data_revisao is not None
    assert all(c["name"] != "Isabela Monteiro" for c in client.get("/artists").json())


def test_admin_rejects_with_note(client, as_, db):
    as_("admin")
    candidate = client.get("/artists").json()[1]
    response = client.patch(f"/artists/{candidate['id']}", json={"decision": "rejected", "note": "Envie fotos mais nítidas."})
    assert response.json()["message"] == "Cadastro devolvido com observações."
    rejected = client.get("/artists", params={"status": "rejected"}).json()
    assert rejected[0]["reviewNote"] == "Envie fotos mais nítidas."


def test_review_rules(client, as_):
    as_("admin")
    candidate = client.get("/artists").json()[0]
    url = f"/artists/{candidate['id']}"
    assert client.patch(url, json={"decision": "talvez", "note": ""}).status_code == 422
    assert client.patch(url, json={"decision": "approved", "note": "x" * 501}).status_code == 422
    assert client.patch("/artists/99999", json={"decision": "approved", "note": ""}).status_code == 404
    assert client.patch(url, json={"decision": "approved", "note": ""}).status_code == 200
    assert client.patch(url, json={"decision": "rejected", "note": ""}).status_code == 409  # já analisado


def test_cannot_review_a_buyer_or_non_admin_cannot_review(client, as_):
    as_("buyer")
    me = client.get("/me").json()
    assert client.patch(f"/artists/{me['id']}", json={"decision": "approved", "note": ""}).status_code == 403
    client.post("/auth/logout")
    as_("admin")
    assert client.patch(f"/artists/{me['id']}", json={"decision": "approved", "note": ""}).status_code == 404  # comprador não é artista
