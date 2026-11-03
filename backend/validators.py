import re
from decimal import Decimal, InvalidOperation

from email_validator import EmailNotValidError, validate_email

from errors import ApiError


def clean_text(value: str | None) -> str:
    return (value or "").strip()


def valid_email(value: str) -> str:
    try:
        return validate_email(value.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        raise ApiError(400, "Informe um e-mail válido.", "email")


def valid_cpf(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 11 or digits == digits[0] * 11:
        raise ApiError(400, "Informe um CPF válido.", "cpf")
    for size in (9, 10):
        total = sum(int(d) * w for d, w in zip(digits[:size], range(size + 1, 1, -1)))
        check = (total * 10 % 11) % 10
        if check != int(digits[size]):
            raise ApiError(400, "Informe um CPF válido.", "cpf")
    return digits


def _brazilian_number(value: str) -> str:
    """Entende o jeito brasileiro de digitar: 1250, 1250,50, 1.250,50 e 12.500 (ponto de milhar).
    Um único ponto com 1 ou 2 casas (1250.5) continua sendo decimal."""
    text = clean_text(value)
    if "," in text or re.fullmatch(r"\d{1,3}(\.\d{3})+", text):
        return text.replace(".", "").replace(",", ".")
    return text


def valid_price(value: str) -> Decimal:
    try:
        price = Decimal(_brazilian_number(value))
    except InvalidOperation:
        raise ApiError(400, "Informe um preço válido.", "price")
    if not price.is_finite() or price <= 0 or price > Decimal("9999999.99"):
        raise ApiError(400, "O preço deve ser maior que zero.", "price")
    return price.quantize(Decimal("0.01"))


def optional_dimension(value: str | None, field: str) -> Decimal | None:
    text = clean_text(value)
    if not text:
        return None
    try:
        number = Decimal(_brazilian_number(text))
    except InvalidOperation:
        raise ApiError(400, "Informe uma medida válida.", field)
    if not number.is_finite() or number <= 0 or number > 1000:
        raise ApiError(400, "A medida deve ficar entre 0 e 1000 cm.", field)
    return number.quantize(Decimal("0.01"))
