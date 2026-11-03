import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "sim", "yes"}


# Origens do front-end autorizadas (CORS). Separe várias por vírgula.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Endereço público da API: usado para montar a URL das imagens enviadas.
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "http://localhost:8000").rstrip("/")

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_MB", "10")) * 1024 * 1024

# Sessão (cookie HttpOnly com JWT)
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_HOURS = int(os.getenv("JWT_HOURS", "8"))
COOKIE_NAME = "namba_session"
COOKIE_SECURE = _bool("COOKIE_SECURE", False)  # True em produção (HTTPS)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")  # "none" só se front e API estiverem em domínios diferentes

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Pedidos
ORDER_EXPIRY_HOURS = int(os.getenv("ORDER_EXPIRY_HOURS", "24"))  # prazo para pagar; depois a obra volta à vitrine
MAX_ORDER_ITEMS = 10
# Pagamento SEM cobrança real, só para testar o fluxo. Ligado só em desenvolvimento e nunca em produção.
FAKE_PAYMENTS = _bool("FAKE_PAYMENTS", ENVIRONMENT.lower() == "development") and ENVIRONMENT.lower() != "production"


# Recuperação de senha. Sem SMTP_HOST o e-mail não é enviado: em desenvolvimento o link aparece no terminal da API.
FRONTEND_URL = os.getenv("FRONTEND_URL", CORS_ORIGINS[0] if CORS_ORIGINS else "http://localhost:5173").rstrip("/")
RESET_TOKEN_MINUTES = int(os.getenv("RESET_TOKEN_MINUTES", "60"))
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "nao-responda@nambagalerie.com")


def jwt_secret() -> str:
    # Sem segredo definido a API não sobe: um valor padrão permitiria forjar logins.
    if len(JWT_SECRET) < 32:
        raise RuntimeError("Defina JWT_SECRET no .env com pelo menos 32 caracteres (veja .env.example).")
    return JWT_SECRET
