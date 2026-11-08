import config
from tests.conftest import JPG, PNG, artist_form, image


def artwork_form(**overrides) -> dict:
    data = {"title": "Maré Alta", "technique": "Óleo", "description": "Mar ao entardecer.", "price": "1.250,00".replace(".", ""),
            "width": "60", "height": "80", "year": "2025", "submitType": "publish"}
    data.update(overrides)
    return data


def test_public_list_shows_only_published_without_login(client):
    artworks = client.get("/artworks").json()
    assert len(artworks) == 6
    first = artworks[0]
    assert set(["id", "title", "artistName", "technique", "description", "price", "year", "width", "height", "image", "status"]) <= set(first)
    assert all(a["status"] == "published" for a in artworks)
    assert {a["technique"] for a in artworks} == {"Acrílica", "Óleo", "Aquarela", "Arte Contemporânea", "Pastel", "Técnica Mista"}


def test_only_approved_artists_can_publish(client, as_):
    files = [("images", image())]
    assert client.post("/artworks", data=artwork_form(), files=files).status_code == 401   # sem login
    as_("buyer")
    assert client.post("/artworks", data=artwork_form(), files=files).status_code == 403
    client.post("/auth/logout")
    as_("pending")
    assert client.post("/artworks", data=artwork_form(), files=files).status_code == 403
    client.post("/auth/logout")
    as_("admin")
    assert client.post("/artworks", data=artwork_form(), files=files).status_code == 403


def test_approved_artist_publishes_and_image_is_served(client, as_):
    as_("artist")
    response = client.post("/artworks", data=artwork_form(), files=[("images", image()), ("images", image("b.jpg", JPG, "image/jpeg"))])
    assert response.status_code == 201, response.text
    art = response.json()["artwork"]
    assert art["artistName"] == "Mariana Luz" and art["technique"] == "Óleo" and art["price"] == 1250.0
    assert art["width"] == 60.0 and art["status"] == "published" and len(art["images"]) == 2
    assert art["image"].startswith(config.API_PUBLIC_URL + "/uploads/")
    path = art["image"].removeprefix(config.API_PUBLIC_URL)
    assert client.get(path).content == PNG
    assert art["id"] in [a["id"] for a in client.get("/artworks").json()]


def test_draft_is_visible_only_to_owner_and_admin(client, as_):
    as_("artist")
    created = client.post("/artworks", data=artwork_form(submitType="draft"), files=[("images", image())]).json()
    assert created["artwork"]["status"] == "draft"
    draft_id = created["artwork"]["id"]
    assert draft_id in [a["id"] for a in client.get("/artworks").json()]        # dono vê
    client.post("/auth/logout")
    assert draft_id not in [a["id"] for a in client.get("/artworks").json()]    # visitante não vê
    as_("buyer")
    assert draft_id not in [a["id"] for a in client.get("/artworks").json()]    # comprador não vê
    client.post("/auth/logout")
    as_("admin")
    assert draft_id in [a["id"] for a in client.get("/artworks").json()]        # admin vê


def test_artwork_validations(client, as_):
    as_("artist")
    ok_file = [("images", image())]
    cases = [
        (artwork_form(title="ab"), ok_file, "title"),
        (artwork_form(technique="Escultura"), ok_file, "technique"),
        (artwork_form(price="0"), ok_file, "price"),
        (artwork_form(price="-5"), ok_file, "price"),
        (artwork_form(price="abc"), ok_file, "price"),
        (artwork_form(price="nan"), ok_file, "price"),
        (artwork_form(width="-1"), ok_file, "width"),
        (artwork_form(year="3000"), ok_file, "year"),
        (artwork_form(), [], "images"),
        (artwork_form(), [("images", image(f"{i}.png")) for i in range(6)], "images"),
        (artwork_form(), [("images", image("x.png", b"<?php echo 1; ?>", "image/png"))], "images"),
    ]
    for form, files, field in cases:
        response = client.post("/artworks", data=form, files=files or None)
        assert response.status_code in (400, 422) and response.json()["field"] == field, (field, response.text)
    titles = [a["title"] for a in client.get("/artworks").json()]
    assert "Maré Alta" not in titles  # nenhuma tentativa inválida criou obra


def test_comma_decimal_price_is_accepted(client, as_):
    as_("artist")
    art = client.post("/artworks", data=artwork_form(price="1250,50"), files=[("images", image())]).json()["artwork"]
    assert art["price"] == 1250.5


def test_thousands_separator_price_is_accepted(client, as_):
    as_("artist")
    for typed, expected in (("1.250,00", 1250.0), ("12.500", 12500.0), ("1.250.000,50", 1250000.5), ("1250.5", 1250.5)):
        art = client.post("/artworks", data=artwork_form(price=typed), files=[("images", image())]).json()["artwork"]
        assert art["price"] == expected, typed


def test_oversized_image_is_rejected(client, as_, monkeypatch):
    monkeypatch.setattr(config, "MAX_IMAGE_BYTES", 100)
    as_("artist")
    response = client.post("/artworks", data=artwork_form(), files=[("images", image("big.png", PNG + b"0" * 200))])
    assert response.status_code == 413 and response.json()["field"] == "images"


def test_newly_registered_artist_cannot_publish_until_approved(client, as_):
    files = [("portfolio", image()), ("portfolio", image())]
    client.post("/users", data=artist_form(), files=files)
    assert client.post("/artworks", data=artwork_form(), files=[("images", image())]).status_code == 403
    client.post("/auth/logout")
    as_("admin")
    rafael = next(a for a in client.get("/artists").json() if a["email"] == "rafael@example.com")
    assert client.patch(f"/artists/{rafael['id']}", json={"decision": "approved", "note": ""}).status_code == 200
    client.post("/auth/logout")
    client.post("/auth/login", json={"email": "rafael@example.com", "password": "senha-forte-1"})
    assert client.post("/artworks", data=artwork_form(), files=[("images", image())]).status_code == 201
