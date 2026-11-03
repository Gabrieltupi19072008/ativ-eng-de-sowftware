"""Regras de estoque dos pedidos. Cada obra é única: comprar = reservar a única unidade.

A baixa usa um UPDATE condicional (`quantidade >= 1`), que o banco executa de forma atômica: se duas pessoas
tentarem comprar a mesma obra ao mesmo tempo, só um UPDATE altera a linha. O CHECK (quantidade >= 0) do
sql/01_schema.sql é a segunda barreira.
"""
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from models import Estoque, ItemPedido, Pagamento, Pedido


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
