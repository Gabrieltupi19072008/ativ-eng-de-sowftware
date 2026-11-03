"""Tabelas do banco (mesmas de sql/01_schema.sql + sql/02_ajustes_front.sql)."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

PAPEIS = ("COMPRADOR", "ARTISTA", "ADMIN")
STATUS_ARTISTA = ("NAO_APLICAVEL", "PENDENTE", "APROVADO", "REJEITADO")


class Cliente(Base):
    __tablename__ = "cliente"

    id_cliente: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    telefone: Mapped[str | None] = mapped_column(String(30))
    biografia: Mapped[str | None] = mapped_column(Text)
    data_cadastro: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ativo: Mapped[str] = mapped_column(String(1), server_default="S")
    papel: Mapped[str] = mapped_column(String(10), server_default="COMPRADOR")
    status_artista: Mapped[str] = mapped_column(String(20), server_default="NAO_APLICAVEL")
    cpf: Mapped[str | None] = mapped_column(String(11))
    cidade: Mapped[str | None] = mapped_column(String(80))
    estado: Mapped[str | None] = mapped_column(String(2))
    estilo_artistico: Mapped[str | None] = mapped_column(String(80))
    observacao_revisao: Mapped[str | None] = mapped_column(String(500))
    id_revisor: Mapped[int | None] = mapped_column(ForeignKey("cliente.id_cliente"))
    data_revisao: Mapped[datetime | None] = mapped_column(DateTime)

    enderecos: Mapped[list["Endereco"]] = relationship(back_populates="cliente", order_by="Endereco.id_endereco")
    portfolio: Mapped[list["PortfolioImagem"]] = relationship(order_by="PortfolioImagem.ordem")


class Endereco(Base):
    __tablename__ = "endereco"

    id_endereco: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id_cliente"))
    tipo: Mapped[str] = mapped_column(String(20))
    logradouro: Mapped[str] = mapped_column(String(150))
    numero: Mapped[str] = mapped_column(String(20))
    complemento: Mapped[str | None] = mapped_column(String(100))
    bairro: Mapped[str] = mapped_column(String(80))
    cidade: Mapped[str] = mapped_column(String(80))
    estado: Mapped[str] = mapped_column(String(2))
    cep: Mapped[str] = mapped_column(String(10))

    cliente: Mapped[Cliente] = relationship(back_populates="enderecos")


class Categoria(Base):
    __tablename__ = "categoria"

    id_categoria: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(80), unique=True)
    descricao: Mapped[str | None] = mapped_column(String(255))


class Produto(Base):
    __tablename__ = "produto"

    id_produto: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_artista: Mapped[int] = mapped_column(ForeignKey("cliente.id_cliente"))
    nome: Mapped[str] = mapped_column(String(150))
    descricao: Mapped[str | None] = mapped_column(Text)
    sku: Mapped[str] = mapped_column(String(60), unique=True)
    preco: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    url_imagem: Mapped[str] = mapped_column(String(255))
    ativo: Mapped[str] = mapped_column(String(1), server_default="S")
    data_cadastro: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ano: Mapped[int | None] = mapped_column(SmallInteger)
    largura_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    altura_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    status: Mapped[str] = mapped_column(String(10), server_default="PUBLICADA")

    artista: Mapped[Cliente] = relationship(foreign_keys=[id_artista])
    categorias: Mapped[list[Categoria]] = relationship(secondary="produto_categoria")
    imagens: Mapped[list["ProdutoImagem"]] = relationship(order_by="ProdutoImagem.ordem")
    estoque: Mapped["Estoque | None"] = relationship(uselist=False)


class ProdutoCategoria(Base):
    __tablename__ = "produto_categoria"

    id_produto: Mapped[int] = mapped_column(ForeignKey("produto.id_produto"), primary_key=True)
    id_categoria: Mapped[int] = mapped_column(ForeignKey("categoria.id_categoria"), primary_key=True)


class Estoque(Base):
    __tablename__ = "estoque"

    id_produto: Mapped[int] = mapped_column(ForeignKey("produto.id_produto"), primary_key=True)
    quantidade: Mapped[int] = mapped_column(Integer, server_default="1")
    quantidade_minima: Mapped[int] = mapped_column(Integer, server_default="0")


class ProdutoImagem(Base):
    __tablename__ = "produto_imagem"

    id_imagem: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_produto: Mapped[int] = mapped_column(ForeignKey("produto.id_produto"))
    url: Mapped[str] = mapped_column(String(255))
    ordem: Mapped[int] = mapped_column(SmallInteger, server_default="0")


class PortfolioImagem(Base):
    __tablename__ = "portfolio_imagem"

    id_imagem: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id_cliente"))
    url: Mapped[str] = mapped_column(String(255))
    ordem: Mapped[int] = mapped_column(SmallInteger, server_default="0")


class Pedido(Base):
    __tablename__ = "pedido"

    id_pedido: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id_cliente"))
    id_endereco_entrega: Mapped[int] = mapped_column(ForeignKey("endereco.id_endereco"))
    data_pedido: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), server_default="AGUARDANDO")
    valor_frete: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0")
    tipo_entrega: Mapped[str] = mapped_column(String(10), server_default="ENVIO")
    data_expiracao: Mapped[datetime | None] = mapped_column(DateTime)

    endereco: Mapped[Endereco] = relationship()
    itens: Mapped[list["ItemPedido"]] = relationship(order_by="ItemPedido.id_produto")
    pagamento: Mapped["Pagamento | None"] = relationship(uselist=False)


class ItemPedido(Base):
    __tablename__ = "item_pedido"

    id_pedido: Mapped[int] = mapped_column(ForeignKey("pedido.id_pedido"), primary_key=True)
    id_produto: Mapped[int] = mapped_column(ForeignKey("produto.id_produto"), primary_key=True)
    quantidade: Mapped[int] = mapped_column(Integer)
    preco_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    produto: Mapped[Produto] = relationship()


class Pagamento(Base):
    __tablename__ = "pagamento"

    id_pagamento: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_pedido: Mapped[int] = mapped_column(ForeignKey("pedido.id_pedido"), unique=True)
    forma: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), server_default="PENDENTE")
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    data_pagamento: Mapped[datetime | None] = mapped_column(DateTime)
