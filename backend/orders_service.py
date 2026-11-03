"""Regras de estoque dos pedidos. Cada obra é única: comprar = reservar a única unidade.

A baixa usa um UPDATE condicional (`quantidade >= 1`), que o banco executa de forma atômica: se duas pessoas
tentarem comprar a mesma obra ao mesmo tempo, só um UPDATE altera a linha. O CHECK (quantidade >= 0) do
sql/01_schema.sql é a segunda barreira.
"""
from datetime import date, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from models import Cliente, Entrega, Estoque, ItemPedido, Pagamento, Pedido, Produto


def release_stock(db: Session, order_id: int) -> None:
    for item in db.execute(select(ItemPedido.id_produto, ItemPedido.quantidade).where(ItemPedido.id_pedido == order_id)):
        db.execute(update(Estoque).where(Estoque.id_produto == item.id_produto).values(quantidade=Estoque.quantidade + item.quantidade))


def cancel_waiting_order(db: Session, order_id: int) -> bool:
    """Cancela um pedido que ainda aguarda pagamento e devolve as obras ao estoque. Não faz commit.
    Devolve False se o pedido já não estava aguardando (assim, nunca devolve o estoque duas vezes)."""
    done = db.execute(update(Pedido).where(Pedido.id_pedido == order_id, Pedido.status == "AGUARDANDO").values(status="CANCELADO"))
    if done.rowcount != 1:
        return False
    release_stock(db, order_id)
    return True


def expire_orders(db: Session) -> int:
    """Cancela os pedidos vencidos. Roda antes de listar obras e pedidos, então não precisa de agendador."""
    overdue = list(db.scalars(select(Pedido.id_pedido).where(Pedido.status == "AGUARDANDO", Pedido.data_expiracao < datetime.now())))
    cancelled = sum(cancel_waiting_order(db, order_id) for order_id in overdue)
    if overdue:
        db.commit()
    return cancelled


def mark_paid(db: Session, order_id: int) -> bool:
    """Pagamento aprovado. Não faz commit. Só vale para pedido que ainda aguarda."""
    done = db.execute(update(Pedido).where(Pedido.id_pedido == order_id, Pedido.status == "AGUARDANDO").values(status="PAGO"))
    if done.rowcount != 1:
        return False
    db.execute(update(Pagamento).where(Pagamento.id_pedido == order_id).values(status="APROVADO", data_pagamento=datetime.now()))
    return True


def order_artist_ids(db: Session, order_id: int) -> set[int]:
    return set(db.scalars(select(Produto.id_artista).join(ItemPedido, ItemPedido.id_produto == Produto.id_produto).where(ItemPedido.id_pedido == order_id)))


def can_fulfil(user: Cliente, artist_ids: set[int]) -> bool:
    """Quem pode marcar envio e entrega: o administrador, ou o artista dono de TODAS as obras do pedido.
    Pedido com obras de artistas diferentes só o administrador mexe (a modelagem de entrega por artista ainda está em aberto)."""
    return user.papel == "ADMIN" or (user.papel == "ARTISTA" and artist_ids == {user.id_cliente})


def mark_shipped(db: Session, order_id: int, tracking_code: str, carrier: str) -> bool:
    """PAGO -> ENVIADO e grava a entrega. Não faz commit. Só vale para pedido pago (nunca envia duas vezes)."""
    done = db.execute(update(Pedido).where(Pedido.id_pedido == order_id, Pedido.status == "PAGO").values(status="ENVIADO"))
    if done.rowcount != 1:
        return False
    db.add(Entrega(id_pedido=order_id, codigo_rastreio=tracking_code, transportadora=carrier, data_envio=date.today()))
    return True


def mark_delivered(db: Session, order_id: int) -> bool:
    """ENVIADO -> ENTREGUE. Não faz commit."""
    done = db.execute(update(Pedido).where(Pedido.id_pedido == order_id, Pedido.status == "ENVIADO").values(status="ENTREGUE"))
    if done.rowcount != 1:
        return False
    db.execute(update(Entrega).where(Entrega.id_pedido == order_id).values(data_entrega=date.today()))
    return True
