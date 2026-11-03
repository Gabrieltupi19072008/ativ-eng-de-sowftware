from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

import config
from database import engine
from errors import ApiError
from routers import artists, artworks, auth, orders, sales, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    config.jwt_secret()  # falha já na inicialização se o segredo não estiver configurado
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="API Loja de Quadros", lifespan=lifespan)

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def block_foreign_origins(request: Request, call_next):
    # Proteção contra CSRF: o navegador sempre envia Origin em pedidos de escrita vindos de outro site.
    origin = request.headers.get("origin")
    if request.method in UNSAFE_METHODS and origin and origin not in config.CORS_ORIGINS:
        return JSONResponse(status_code=403, content={"ok": False, "message": "Origem não autorizada."})
    return await call_next(request)


# Adicionado depois do middleware acima, então roda antes dele.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,  # necessário para o cookie de sessão
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError):
    body = {"ok": False, "message": exc.message}
    if exc.field:
        body["field"] = exc.field
    body.update(exc.extra)
    return JSONResponse(status_code=exc.status, content=body)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = next((str(part) for part in reversed(first.get("loc", ())) if isinstance(part, str) and part not in {"body", "query"}), None)
    body = {"ok": False, "message": "Dados inválidos. Revise o formulário."}
    if field:
        body["field"] = field
    return JSONResponse(status_code=422, content=body)


config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(artworks.router)
app.include_router(artists.router)
app.include_router(orders.router)
app.include_router(sales.router)


@app.get("/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}
