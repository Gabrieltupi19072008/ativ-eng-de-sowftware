"""Validação do endereço de entrega, compartilhada pelo checkout e pela aba Endereços da conta."""
import re

from pydantic import BaseModel, Field

from errors import ApiError


class AddressIn(BaseModel):
    cep: str = Field(max_length=20)
    street: str = Field(max_length=150)
    number: str = Field(max_length=20)
    complement: str = Field(default="", max_length=100)
    neighborhood: str = Field(max_length=80)
    city: str = Field(max_length=80)
    state: str = Field(max_length=2)


def clean_address(data: AddressIn) -> dict:
    """Confere os campos e devolve os valores prontos para gravar (CEP no formato 00000-000, estado em maiúsculas)."""
    cep = re.sub(r"\D", "", data.cep)
    street, number, neighborhood, city = (v.strip() for v in (data.street, data.number, data.neighborhood, data.city))
    complement, state = data.complement.strip(), data.state.strip().upper()
    if len(cep) != 8:
        raise ApiError(400, "Informe um CEP válido.", "cep")
    for value, field, label in ((street, "street", "a rua"), (number, "number", "o número"), (neighborhood, "neighborhood", "o bairro"), (city, "city", "a cidade")):
        if not value:
            raise ApiError(400, f"Informe {label}.", field)
    if not re.fullmatch(r"[A-Z]{2}", state):
        raise ApiError(400, "Informe o estado com 2 letras (ex.: SP).", "state")
    return {"cep": f"{cep[:5]}-{cep[5:]}", "street": street, "number": number, "complement": complement or None, "neighborhood": neighborhood, "city": city, "state": state}
