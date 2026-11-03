"""Converte as linhas do banco para o formato (camelCase) que o front-end React usa."""
import config
from models import Cliente, Pedido, Produto

ROLE_OUT = {"COMPRADOR": "buyer", "ARTISTA": "artist", "ADMIN": "admin"}
ROLE_IN = {"buyer": "COMPRADOR", "artist": "ARTISTA"}
STATUS_OUT = {"NAO_APLICAVEL": "not-applicable", "PENDENTE": "pending", "APROVADO": "approved", "REJEITADO": "rejected"}
STATUS_IN = {"pending": "PENDENTE", "approved": "APROVADO", "rejected": "REJEITADO"}


def absolute_url(url: str) -> str:
    return url if url.startswith(("http://", "https://")) else f"{config.API_PUBLIC_URL}{url}"


def _number(value) -> float | None:
    return float(value) if value is not None else None


def user_view(c: Cliente) -> dict:
    address = next((e for e in c.enderecos if e.tipo == "ENTREGA"), None)
    view = {
        "id": str(c.id_cliente),
        "name": c.nome,
        "email": c.email,
        "role": ROLE_OUT[c.papel],
        "artistStatus": STATUS_OUT[c.status_artista],
        "city": c.cidade or (address.cidade if address else ""),
    }
    if address:
        view["address"] = {
            "cep": address.cep,
            "street": address.logradouro,
            "number": address.numero,
            "complement": address.complemento or "",
            "neighborhood": address.bairro,
            "city": address.cidade,
            "state": address.estado,
        }
    return view


def artwork_status(p: Produto, reserved: bool = False) -> str:
    """draft = rascunho; reserved = em pedido ainda não pago; sold = estoque zerado; published = à venda."""
    if p.status != "PUBLICADA":
        return "draft"
    if (p.estoque.quantidade if p.estoque else 0) <= 0:
        return "reserved" if reserved else "sold"
    return "published"


def artwork_view(p: Produto, reserved: bool = False) -> dict:
    return {
        "id": str(p.id_produto),
        "title": p.nome,
        "artistName": p.artista.nome,
        "technique": p.categorias[0].nome if p.categorias else "",
        "description": p.descricao or "",
        "price": float(p.preco),
        "year": p.ano,
        "width": _number(p.largura_cm),
        "height": _number(p.altura_cm),
        "image": absolute_url(p.url_imagem),
        "images": [absolute_url(i.url) for i in p.imagens] or [absolute_url(p.url_imagem)],
        "status": artwork_status(p, reserved),
    }


def candidate_view(c: Cliente) -> dict:
    return {
        "id": str(c.id_cliente),
        "name": c.nome,
        "email": c.email,
        "city": c.cidade or "Localização não informada",
        "state": c.estado or "",
        "artStyle": c.estilo_artistico or "Estilo não informado",
        "artistBio": c.biografia or "",
        "createdAt": c.data_cadastro.isoformat(),
        "portfolio": [absolute_url(i.url) for i in c.portfolio],
        "status": STATUS_OUT[c.status_artista],
        "reviewNote": c.observacao_revisao or "",
    }


ORDER_STATUS_OUT = {"AGUARDANDO": "pending", "PAGO": "paid", "ENVIADO": "shipped", "ENTREGUE": "delivered", "CANCELADO": "cancelled"}
PAYMENT_OUT = {"PIX": "pix", "BOLETO": "boleto", "CARTAO": "credit"}
PAYMENT_IN = {"pix": "PIX", "boleto": "BOLETO", "credit": "CARTAO"}
PAYMENT_STATUS_OUT = {"PENDENTE": "pending", "APROVADO": "approved", "RECUSADO": "declined", "ESTORNADO": "refunded"}


def order_view(o: Pedido, fake_payments: bool = False) -> dict:
    subtotal = sum(float(i.preco_unitario) * i.quantidade for i in o.itens)
    waiting = o.status == "AGUARDANDO"
    address = o.endereco
    return {
        "id": str(o.id_pedido),
        "number": f"NG-{o.id_pedido:06d}",
        "status": ORDER_STATUS_OUT[o.status],
        "createdAt": o.data_pedido.isoformat(),
        "expiresAt": o.data_expiracao.isoformat() if o.data_expiracao and waiting else None,
        "subtotal": round(subtotal, 2),
        "shipping": float(o.valor_frete),
        "total": round(subtotal + float(o.valor_frete), 2),
        "deliveryType": "shipping" if o.tipo_entrega == "ENVIO" else "pickup",
        "paymentMethod": PAYMENT_OUT[o.pagamento.forma] if o.pagamento else None,
        "paymentStatus": PAYMENT_STATUS_OUT[o.pagamento.status] if o.pagamento else None,
        "items": [
            {
                "artworkId": str(i.id_produto),
                "title": i.produto.nome,
                "artistName": i.produto.artista.nome,
                "price": float(i.preco_unitario),
                "image": absolute_url(i.produto.url_imagem),
            }
            for i in o.itens
        ],
        "address": {
            "cep": address.cep, "street": address.logradouro, "number": address.numero, "complement": address.complemento or "",
            "neighborhood": address.bairro, "city": address.cidade, "state": address.estado,
        },
        "canCancel": waiting,
        "canSimulatePayment": waiting and fake_payments,
    }
