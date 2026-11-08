"""Dados de exemplo para desenvolvimento: técnicas, contas de teste e obras da vitrine.

Uso (com o banco criado pelos scripts da pasta sql/):
    python seed.py

Pode rodar mais de uma vez: só cria o que ainda não existe.
NUNCA rode em produção: as senhas abaixo são públicas.
"""
import os
import sys
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from models import Categoria, Cliente, Estoque, PortfolioImagem, Produto, ProdutoImagem
from security import hash_password

TECHNIQUES = {
    "Óleo": "Pintura a óleo",
    "Aquarela": "Pintura em aquarela",
    "Acrílica": "Pintura em tinta acrílica",
    "Pastel": "Pastel seco ou oleoso",
    "Arte Contemporânea": "Linguagens e suportes atuais",
    "Técnica Mista": "Combinação de técnicas",
}

DEMO_PASSWORD = "Galerie123!"
UNSPLASH = "https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=900&q=85"

# (nome, e-mail, senha, papel, status, cidade, estado)
ACCOUNTS = [
    ("Camila Prado", "comprador@nambagalerie.com", "comprador@123", "COMPRADOR", "NAO_APLICAVEL", "São Paulo", "SP"),
    ("Mariana Luz", "comerciante@nambagalerie.com", "comerciante@123", "ARTISTA", "APROVADO", "Goiânia", "GO"),
    ("Curadoria Nambá", "admin@nambagalerie.com", os.getenv("SEED_ADMIN_PASSWORD", "nambagalerie@"), "ADMIN", "NAO_APLICAVEL", "São Paulo", "SP"),
    ("Carlos Neves", "carlos@galerie.demo", DEMO_PASSWORD, "ARTISTA", "APROVADO", "Curitiba", "PR"),
    ("Ana Beatriz", "ana@galerie.demo", DEMO_PASSWORD, "ARTISTA", "APROVADO", "Salvador", "BA"),
    ("Pedro Alves", "pedro@galerie.demo", DEMO_PASSWORD, "ARTISTA", "APROVADO", "Porto Alegre", "RS"),
    ("Lúcia Ferreira", "lucia@galerie.demo", DEMO_PASSWORD, "ARTISTA", "APROVADO", "Rio de Janeiro", "RJ"),
    ("Thiago Ramos", "thiago@galerie.demo", DEMO_PASSWORD, "ARTISTA", "APROVADO", "Recife", "PE"),
]

# Candidatos esperando a curadoria (aparecem no painel do administrador)
CANDIDATES = [
    ("Isabela Monteiro", "isabela@galerie.demo", "Belo Horizonte", "MG", "Abstracionismo",
     "Pesquisa cor, gesto e memória em composições abstratas construídas por camadas.",
     ["1547826039-bfc35e0f1ea8", "1547826039-bfc35e0f1ea8", "1547826039-bfc35e0f1ea8"]),
    ("Diego Cavalcante", "diego@galerie.demo", "Recife", "PE", "Pintura gestual",
     "Investiga ritmo, matéria e paisagem por meio de pinceladas livres e contrastes intensos.",
     ["1541701494587-cb58502866ab", "1547826039-bfc35e0f1ea8"]),
]

# (título, artista, técnica, descrição, preço, ano, largura, altura, foto)
ARTWORKS = [
    ("Entardecer no Cerrado", "Mariana Luz", "Acrílica", "Camadas quentes inspiradas no horizonte do cerrado.", "1200", 2025, 60, 80, "1541961017774-22349e4a1262"),
    ("Azul em Movimento", "Carlos Neves", "Óleo", "Gestos livres em azul profundo e amarelo mineral.", "2800", 2024, 90, 120, "1552312097-8ef75595e2a2"),
    ("Jardim Suspenso", "Ana Beatriz", "Aquarela", "Estudo botânico de transparências e luz.", "950", 2026, 42, 59, "1618331835717-801e976710b2"),
    ("Geometria Urbana", "Pedro Alves", "Arte Contemporânea", "Arquitetura imaginada a partir de ritmos urbanos.", "1750", 2025, 70, 70, "1533208087231-c3618eab623c"),
    ("Vermelho Essencial", "Lúcia Ferreira", "Pastel", "Cor e matéria em equilíbrio silencioso.", "3400", 2023, 80, 100, "1533157950006-c38844053d55"),
    ("Cartografia Afetiva", "Thiago Ramos", "Técnica Mista", "Memórias transformadas em paisagens abstratas.", "880", 2026, 50, 70, "1605721911519-3dfeb3be25e7"),
]


def run(db: Session) -> dict[str, int]:
    created = {"categorias": 0, "contas": 0, "obras": 0}

    categories = {c.nome: c for c in db.scalars(select(Categoria))}
    for name, description in TECHNIQUES.items():
        if name not in categories:
            categories[name] = Categoria(nome=name, descricao=description)
            db.add(categories[name])
            created["categorias"] += 1
    db.flush()

    people = {c.email: c for c in db.scalars(select(Cliente))}

    def add_person(**fields) -> Cliente:
        person = Cliente(**fields)
        db.add(person)
        people[person.email] = person
        created["contas"] += 1
        return person

    for name, email, password, role, status, city, state in ACCOUNTS:
        if email not in people:
            add_person(nome=name, email=email, senha_hash=hash_password(password), papel=role, status_artista=status, cidade=city, estado=state)

    for name, email, city, state, style, bio, photos in CANDIDATES:
        if email not in people:
            person = add_person(
                nome=name, email=email, senha_hash=hash_password(DEMO_PASSWORD), papel="ARTISTA", status_artista="PENDENTE",
                cidade=city, estado=state, estilo_artistico=style, biografia=bio,
            )
            for order, photo in enumerate(photos):
                person.portfolio.append(PortfolioImagem(url=UNSPLASH.format(id=photo), ordem=order))
    db.flush()

    existing_titles = {(p.nome, p.id_artista) for p in db.scalars(select(Produto))}
    for title, artist, technique, description, price, year, width, height, photo in ARTWORKS:
        owner = next(p for p in people.values() if p.nome == artist and p.papel == "ARTISTA")
        if (title, owner.id_cliente) in existing_titles:
            continue
        url = UNSPLASH.format(id=photo)
        product = Produto(
            id_artista=owner.id_cliente, nome=title, descricao=description, sku=f"SEED-{len(existing_titles) + created['obras'] + 1:04d}",
            preco=Decimal(price), url_imagem=url, ano=year, largura_cm=Decimal(width), altura_cm=Decimal(height), status="PUBLICADA",
        )
        product.categorias.append(categories[technique])
        product.imagens = [ProdutoImagem(url=url, ordem=0)]
        product.estoque = Estoque(quantidade=1)
        db.add(product)
        created["obras"] += 1

    db.commit()
    return created


if __name__ == "__main__":
    if config.ENVIRONMENT.lower() == "production":
        sys.exit("Recusado: o seed cria contas com senhas públicas e não pode rodar em produção.")
    from database import SessionLocal

    with SessionLocal() as session:
        try:
            print("Criado:", run(session))
        except Exception as error:  # noqa: BLE001 - mensagem amigável para quem está começando
            session.rollback()
            sys.exit(f"Falhou: {error}\nConfira se rodou sql/01_schema.sql e sql/02_ajustes_front.sql e se o .env está correto.")
