"""Teste de ponta a ponta contra a API e o banco REAIS (SQL Server).

Diferente do pytest (que usa SQLite), este roteiro passa por HTTP, pelo SQL Server e pelos scripts da pasta sql/.
Pré-requisitos: banco criado (sql/00, 01, 02), seed.py executado e a API no ar em http://localhost:8000.

    python scripts/smoke_sqlserver.py

Cria contas e obras com e-mail @example.com e APAGA tudo isso no final (as contas do seed não são tocadas).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import random
import time

import httpx

BASE = "http://localhost:8000"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
stamp = str(int(time.time()))

def make_cpf():
    n = [random.randint(0, 9) for _ in range(9)]
    for size in (9, 10):
        total = sum(d * w for d, w in zip(n, range(size + 1, 1, -1)))
        n.append((total * 10 % 11) % 10)
    return "".join(map(str, n))


def cleanup():
    from sqlalchemy import delete, select

    from database import SessionLocal
    from models import Cliente, Endereco, Entrega, Estoque, ItemPedido, Pagamento, Pedido, PortfolioImagem, Produto, ProdutoCategoria, ProdutoImagem

    with SessionLocal() as db:
        users = list(db.scalars(select(Cliente.id_cliente).where(Cliente.email.like("%@example.com"))))
        if not users:
            return
        products = list(db.scalars(select(Produto.id_produto).where(Produto.id_artista.in_(users))))
        orders = list(db.scalars(select(Pedido.id_pedido).where(Pedido.id_cliente.in_(users))))
        db.execute(delete(Entrega).where(Entrega.id_pedido.in_(orders)))
        db.execute(delete(Pagamento).where(Pagamento.id_pedido.in_(orders)))
        db.execute(delete(ItemPedido).where((ItemPedido.id_pedido.in_(orders)) | (ItemPedido.id_produto.in_(products))))
        db.execute(delete(Pedido).where(Pedido.id_pedido.in_(orders)))
        for table, column, ids in (
            (ProdutoImagem, ProdutoImagem.id_produto, products), (ProdutoCategoria, ProdutoCategoria.id_produto, products),
            (Estoque, Estoque.id_produto, products), (Produto, Produto.id_produto, products),
            (PortfolioImagem, PortfolioImagem.id_cliente, users), (Endereco, Endereco.id_cliente, users),
        ):
            db.execute(delete(table).where(column.in_(ids)))
        db.query(Cliente).filter(Cliente.id_revisor.in_(users)).update({Cliente.id_revisor: None}, synchronize_session=False)
        db.execute(delete(Cliente).where(Cliente.id_cliente.in_(users)))
        db.commit()
        print(f"Limpeza: {len(users)} contas, {len(products)} obras e {len(orders)} pedidos de teste removidos.")


def main():
    passed = []

    def check(name, cond, extra=""):
        print("OK   " if cond else "FALHA", name, extra)
        if not cond:
            raise SystemExit(1)
        passed.append(name)

    def client(): return httpx.Client(base_url=BASE, headers={"Origin": "http://localhost:5173"})

    # 1) comprador se cadastra com endereço e telefone
    buyer = client()
    r = buyer.post("/users", data={"role": "buyer", "name": "Comprador E2E", "email": f"buyer{stamp}@example.com", "password": "senha-forte-1",
        "cpf": make_cpf(), "phone": "(11) 99999-9999", "cep": "01001-000", "street": "Praça da Sé", "number": "10", "neighborhood": "Sé", "city": "São Paulo", "state": "SP"})
    check("cadastro de comprador", r.status_code == 201, r.text[:80])
    me = buyer.get("/me").json()
    check("sessão por cookie + endereço salvo", me["role"] == "buyer" and me["address"]["street"] == "Praça da Sé")
    check("e-mail repetido recusado", buyer.post("/users", data={"role": "buyer", "name": "Outro", "email": f"BUYER{stamp}@example.com", "password": "senha-forte-1", "cpf": make_cpf()}).status_code == 409)

    # 2) artista se cadastra com portfólio
    artist = client()
    r = artist.post("/users", data={"role": "artist", "name": "Artista E2E", "email": f"artist{stamp}@example.com", "password": "senha-forte-1", "cpf": make_cpf(),
        "city": "Recife", "state": "PE", "artStyle": "Óleo", "artistBio": "Pinto paisagens do litoral com camadas de tinta a óleo e muita luz natural, há dez anos."},
        files=[("portfolio", ("a.png", PNG, "image/png")), ("portfolio", ("b.png", PNG, "image/png"))])
    check("cadastro de artista com 2 imagens", r.status_code == 201 and r.json()["user"]["artistStatus"] == "pending", r.text[:80])
    art_id = r.json()["user"]["id"]
    check("artista pendente não publica", artist.post("/artworks", data={"title": "Nao pode", "technique": "Óleo", "price": "10"}, files=[("images", ("x.png", PNG, "image/png"))]).status_code == 403)

    # 3) admin aprova
    admin = client()
    check("login admin (hash argon2 do seed)", admin.post("/auth/login", json={"email": "admin@nambagalerie.com", "password": "nambagalerie@"}).status_code == 200)
    pend = admin.get("/artists").json()
    check("fila de aprovação mostra o novo artista", any(c["id"] == art_id and len(c["portfolio"]) == 2 for c in pend))
    check("comprador não acessa a fila", buyer.get("/artists").status_code == 403)
    check("admin aprova", admin.patch(f"/artists/{art_id}", json={"decision": "approved", "note": "ok"}).status_code == 200)
    check("aprovar de novo -> 409", admin.patch(f"/artists/{art_id}", json={"decision": "approved", "note": ""}).status_code == 409)

    # 4) artista aprovado publica obra e rascunho
    r = artist.post("/artworks", data={"title": "Obra E2E", "technique": "Óleo", "description": "teste", "price": "1.250,50", "width": "40,5", "height": "50", "year": "2026", "submitType": "published"},
        files=[("images", ("o.png", PNG, "image/png")), ("images", ("o2.png", PNG, "image/png"))])
    check("artista aprovado publica obra", r.status_code == 201 and r.json()["artwork"]["price"] == 1250.5 and r.json()["artwork"]["width"] == 40.5, r.text[:80])
    pub = r.json()["artwork"]
    d = artist.post("/artworks", data={"title": "Rascunho E2E", "technique": "Pastel", "price": "99", "submitType": "draft"}, files=[("images", ("r.png", PNG, "image/png"))]).json()["artwork"]
    check("rascunho criado", d["status"] == "draft")

    anon = client()
    titles = [a["title"] for a in anon.get("/artworks").json()]
    check("vitrine pública mostra a obra e esconde o rascunho", "Obra E2E" in titles and "Rascunho E2E" not in titles)
    check("dono vê o rascunho", "Rascunho E2E" in [a["title"] for a in artist.get("/artworks").json()])
    check("imagem enviada é servida", anon.get(pub["image"].replace("http://localhost:8000", "")).content == PNG)
    check("técnica inválida recusada", artist.post("/artworks", data={"title": "Titulo", "technique": "Escultura", "price": "10"}, files=[("images", ("x.png", PNG, "image/png"))]).status_code == 400)


    # 5) pedidos e estoque (só com obras criadas neste teste, para não mexer no estoque do seed)
    import threading
    from datetime import datetime, timedelta

    def publish(title, price="500"):
        return artist.post("/artworks", data={"title": title, "technique": "Óleo", "price": price, "submitType": "published"},
                           files=[("images", ("p.png", PNG, "image/png"))]).json()["artwork"]

    def order_body(*ids, method="pix"):
        return {"items": [str(i) for i in ids], "address": {"cep": "01001-000", "street": "Praça da Sé", "number": "10", "complement": "",
                "neighborhood": "Sé", "city": "São Paulo", "state": "SP"}, "paymentMethod": method}

    def public_ids():
        return [a["id"] for a in client().get("/artworks").json()]

    buyer2 = client()
    r = buyer2.post("/users", data={"role": "buyer", "name": "Comprador Dois", "email": f"buyer2{stamp}@example.com", "password": "senha-forte-1", "cpf": make_cpf()})
    check("segundo comprador cadastrado", r.status_code == 201)

    a, b = publish("Pedido A", "500"), publish("Pedido B", "1.200,50")
    r = buyer.post("/orders", json=order_body(a["id"], b["id"]))
    order = r.json().get("order", {})
    check("pedido criado, total calculado no servidor", r.status_code == 201 and order["total"] == 1700.5 and order["status"] == "pending", str(order.get("total")))
    check("obras reservadas saem da vitrine", a["id"] not in public_ids() and b["id"] not in public_ids())
    check("outro comprador não leva a mesma obra", buyer2.post("/orders", json=order_body(a["id"])).status_code == 409)
    check("meus pedidos lista o pedido", [o["id"] for o in buyer.get("/orders").json()] == [order["id"]])
    check("outro usuário não vê o pedido", buyer2.get(f"/orders/{order['id']}").status_code == 404)
    check("artista vê a obra como reservada", next(x for x in artist.get("/artworks").json() if x["id"] == a["id"])["status"] == "reserved")

    r = buyer.post(f"/orders/{order['id']}/cancel")
    check("cancelar devolve as obras à vitrine", r.status_code == 200 and a["id"] in public_ids() and b["id"] in public_ids())
    check("cancelar de novo é recusado", buyer.post(f"/orders/{order['id']}/cancel").status_code == 409)

    # a prova que importa: duas pessoas comprando a MESMA obra no mesmo instante
    for round_number in range(1, 6):
        art = publish(f"Corrida {round_number}")
        barrier, results = threading.Barrier(2), []

        def attempt(who, art_id=art["id"]):
            barrier.wait()
            results.append(who.post("/orders", json=order_body(art_id)).status_code)

        threads = [threading.Thread(target=attempt, args=(who,)) for who in (buyer, buyer2)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        check(f"corrida {round_number}: exatamente uma compra vence", sorted(results) == [201, 409], str(results))

    mine = [o for o in buyer.get("/orders").json() + buyer2.get("/orders").json() if o["status"] == "pending"][0]
    owner = buyer if any(o["id"] == mine["id"] for o in buyer.get("/orders").json()) else buyer2
    r = owner.post(f"/orders/{mine['id']}/simulate-payment")
    check("pagamento simulado marca como pago", r.status_code == 200 and r.json()["order"]["status"] == "paid")
    check("artista vê a obra como vendida", next(x for x in artist.get("/artworks").json() if x["id"] == mine["items"][0]["artworkId"])["status"] == "sold")

    # envio e entrega (tabela entrega, com código de rastreio único)
    code = f"SM{stamp}BR"[-13:].upper()
    check("comprador não envia pedido", owner.post(f"/orders/{mine['id']}/ship", json={"trackingCode": code}).status_code == 404)
    sale = next(x for x in artist.get("/sales").json() if x["orderId"] == mine["id"])
    check("artista vê que pode enviar e o endereço", sale["canShip"] is True and sale["shippingAddress"] is not None)
    r = artist.post(f"/orders/{mine['id']}/ship", json={"trackingCode": code})
    check("artista marca como enviado com rastreio", r.status_code == 200 and r.json()["order"]["status"] == "shipped" and r.json()["order"]["shipment"]["trackingCode"] == code, r.text[:120])
    check("enviar de novo é recusado", artist.post(f"/orders/{mine['id']}/ship", json={"trackingCode": code}).status_code == 409)
    check("comprador vê o rastreio", next(o for o in owner.get("/orders").json() if o["id"] == mine["id"])["shipment"]["trackingCode"] == code)
    r = artist.post(f"/orders/{mine['id']}/deliver")
    check("artista marca como entregue", r.status_code == 200 and r.json()["order"]["status"] == "delivered" and r.json()["order"]["shipment"]["deliveredAt"], r.text[:120])

    # pedido vencido volta à vitrine sozinho
    pending = [o for o in buyer.get("/orders").json() + buyer2.get("/orders").json() if o["status"] == "pending"][0]
    from database import SessionLocal
    from sqlalchemy import update
    from models import Pedido as PedidoModel
    with SessionLocal() as db:
        db.execute(update(PedidoModel).where(PedidoModel.id_pedido == int(pending["id"])).values(data_expiracao=datetime.now() - timedelta(minutes=1)))
        db.commit()
    check("pedido vencido libera a obra", pending["items"][0]["artworkId"] in public_ids())

    # 6) logout encerra a sessão
    buyer.post("/auth/logout")
    check("logout", buyer.get("/me").status_code == 401)
    print(f"\n{len(passed)} verificações passaram contra o SQL Server")



if __name__ == "__main__":
    try:
        main()
    finally:
        cleanup()
