"""Armazenamento de imagens no Supabase Storage (a rede é simulada: nenhum teste fala com o Supabase de verdade)."""
import json
import urllib.error

import config
from tests.conftest import PNG, artist_form, image
from tests.test_artworks import artwork_form

PREFIX = "https://proj.supabase.co/storage/v1/object/public/obras/"


class FakeResponse:
    def close(self):
        pass


def fake_supabase(monkeypatch, fail_after: int | None = None):
    """Liga o armazenamento remoto e registra cada chamada (método, endereço, cabeçalhos, corpo)."""
    monkeypatch.setattr(config, "SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", "chave-secreta-de-teste")
    calls = []

    def fake_urlopen(request, timeout=None):
        if request.get_method() == "POST" and fail_after is not None and sum(c["method"] == "POST" for c in calls) >= fail_after:
            raise urllib.error.URLError("sem rede")
        calls.append({"method": request.get_method(), "url": request.full_url, "headers": {k.lower(): v for k, v in request.header_items()}, "body": request.data})
        return FakeResponse()

    monkeypatch.setattr("uploads.urllib.request.urlopen", fake_urlopen)
    return calls


def test_artwork_images_go_to_supabase_and_db_stores_public_url(client, as_, monkeypatch):
    calls = fake_supabase(monkeypatch)
    as_("artist")
    response = client.post("/artworks", data=artwork_form(), files=[("images", image()), ("images", image())])
    assert response.status_code == 201, response.text
    uploads = [c for c in calls if c["method"] == "POST"]
    assert len(uploads) == 2
    assert all(c["url"].startswith("https://proj.supabase.co/storage/v1/object/obras/") for c in uploads)
    assert all(c["headers"]["authorization"] == "Bearer chave-secreta-de-teste" for c in uploads)
    assert uploads[0]["headers"]["content-type"] == "image/png"
    art = response.json()["artwork"]
    assert art["image"].startswith(PREFIX) and all(u.startswith(PREFIX) for u in art["images"])  # endereço público, sem prefixo da nossa API


def test_failed_upload_creates_no_artwork_and_removes_the_sent_images(client, as_, monkeypatch):
    calls = fake_supabase(monkeypatch, fail_after=1)  # a 1ª imagem sobe, a 2ª falha
    as_("artist")
    before = len(client.get("/artworks").json())
    response = client.post("/artworks", data=artwork_form(), files=[("images", image()), ("images", image())])
    assert response.status_code == 502
    assert "guardar as imagens" in response.json()["message"]
    assert len(client.get("/artworks").json()) == before
    deletes = [c for c in calls if c["method"] == "DELETE"]
    assert len(deletes) == 1 and len(json.loads(deletes[0]["body"])["prefixes"]) == 1  # limpou a imagem que já tinha subido


def test_deleting_artwork_removes_its_images_from_supabase(client, as_, monkeypatch):
    calls = fake_supabase(monkeypatch)
    as_("artist")
    created = client.post("/artworks", data=artwork_form(), files=[("images", image()), ("images", image())]).json()["artwork"]
    names = [u[len(PREFIX):] for u in created["images"]]
    assert client.delete(f"/artworks/{created['id']}").status_code == 200
    deletes = [c for c in calls if c["method"] == "DELETE"]
    assert len(deletes) == 1
    assert deletes[0]["url"] == "https://proj.supabase.co/storage/v1/object/obras"
    assert sorted(json.loads(deletes[0]["body"])["prefixes"]) == sorted(names)


def test_without_supabase_images_stay_local(client, as_):
    as_("artist")
    art = client.post("/artworks", data=artwork_form(), files=[("images", image())]).json()["artwork"]
    assert "/uploads/" in art["image"] and "supabase" not in art["image"]
