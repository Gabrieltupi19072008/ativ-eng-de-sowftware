import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()


def _build_engine():
    # DATABASE_URL aponta para o PostgreSQL (Supabase ou contêiner local). Os testes usam SQLite em memória.
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Defina DATABASE_URL no .env (veja .env.example).")
    if url.startswith("sqlite"):
        from sqlalchemy.pool import StaticPool

        return create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    # O Supabase entrega "postgresql://..."; o SQLAlchemy precisa saber que o driver é o psycopg (versão 3)
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+psycopg://" + url[len(prefix):]
    # pool_pre_ping: testa a conexão antes de usar (bancos gratuitos fecham conexões paradas)
    # prepare_threshold=None: compatível com o "pooler" do Supabase, que não aceita comandos preparados
    return create_engine(url, pool_pre_ping=True, pool_recycle=1800, connect_args={"prepare_threshold": None})


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
