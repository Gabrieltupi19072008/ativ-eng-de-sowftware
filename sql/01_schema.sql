USE loja_quadros;
GO

-------- 1. Clientes, Artistas e Endereços
CREATE TABLE cliente (
	id_cliente INTEGER IDENTITY(1,1) PRIMARY KEY,
	nome VARCHAR(120) NOT NULL,
	email VARCHAR(160) NOT NULL UNIQUE,
	senha_hash VARCHAR(255) NOT NULL,
	telefone VARCHAR(30),
	biografia VARCHAR(MAX), 
	data_cadastro DATETIME NOT NULL DEFAULT GETDATE(),
	ativo CHAR(1) NOT NULL DEFAULT 'S',
	CONSTRAINT ck_cliente_ativo CHECK (ativo IN ('S', 'N'))
);

CREATE TABLE endereco (
	id_endereco INTEGER IDENTITY(1,1) PRIMARY KEY,
	id_cliente INTEGER NOT NULL,
	tipo VARCHAR(20) NOT NULL,
	logradouro VARCHAR(150) NOT NULL,
	numero VARCHAR(20) NOT NULL,
	complemento VARCHAR(100),
	bairro VARCHAR(80) NOT NULL,
	cidade VARCHAR(80) NOT NULL,
	estado CHAR(2) NOT NULL,
	cep VARCHAR(10) NOT NULL,
	CONSTRAINT fk_endereco_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
	CONSTRAINT ck_endereco_tipo CHECK (tipo IN ('ENTREGA', 'COBRANCA'))
);

-------- 2. Catálogo de Artes e Estoque
CREATE TABLE categoria (
	id_categoria INTEGER IDENTITY(1,1) PRIMARY KEY,
	nome VARCHAR(80) NOT NULL UNIQUE,
	descricao VARCHAR(255)
);

CREATE TABLE produto (
	id_produto INTEGER IDENTITY(1,1) PRIMARY KEY,
	id_artista INTEGER NOT NULL,
	nome VARCHAR(150) NOT NULL,
	descricao VARCHAR(MAX), 
	sku VARCHAR(60) NOT NULL UNIQUE,
	preco DECIMAL(12, 2) NOT NULL,
	url_imagem VARCHAR(255) NOT NULL, 
	ativo CHAR(1) NOT NULL DEFAULT 'S',
	data_cadastro DATETIME NOT NULL DEFAULT GETDATE(),
	CONSTRAINT fk_produto_artista FOREIGN KEY (id_artista) REFERENCES cliente (id_cliente),
	CONSTRAINT ck_produto_preco CHECK (preco >= 0),
	CONSTRAINT ck_produto_ativo CHECK (ativo IN ('S', 'N'))
);

CREATE TABLE produto_categoria (
	id_produto INTEGER NOT NULL,
	id_categoria INTEGER NOT NULL,
	PRIMARY KEY (id_produto, id_categoria),
	CONSTRAINT fk_produto_categoria_produto FOREIGN KEY (id_produto) REFERENCES produto (id_produto),
	CONSTRAINT fk_produto_categoria_categoria FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
);

CREATE TABLE estoque (
	id_produto INTEGER PRIMARY KEY,
	quantidade INTEGER NOT NULL DEFAULT 1, 
	quantidade_minima INTEGER NOT NULL DEFAULT 0,
	CONSTRAINT fk_estoque_produto FOREIGN KEY (id_produto) REFERENCES produto (id_produto),
	CONSTRAINT ck_estoque_quantidade CHECK (quantidade >= 0),
	CONSTRAINT ck_estoque_minima CHECK (quantidade_minima >= 0)
);

-------- 3. Venda
CREATE TABLE pedido (
	id_pedido INTEGER IDENTITY(1,1) PRIMARY KEY,
	id_cliente INTEGER NOT NULL,
	id_endereco_entrega INTEGER NOT NULL,
	data_pedido DATETIME NOT NULL DEFAULT GETDATE(),
	status VARCHAR(20) NOT NULL DEFAULT 'AGUARDANDO',
	valor_frete DECIMAL(12, 2) NOT NULL DEFAULT 0,
	CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
	CONSTRAINT fk_pedido_endereco FOREIGN KEY (id_endereco_entrega) REFERENCES endereco (id_endereco),
	CONSTRAINT ck_pedido_status CHECK (status IN ('AGUARDANDO', 'PAGO', 'ENVIADO', 'ENTREGUE', 'CANCELADO')),
	CONSTRAINT ck_pedido_frete CHECK (valor_frete >= 0)
);

CREATE TABLE item_pedido (
	id_pedido INTEGER NOT NULL,
	id_produto INTEGER NOT NULL,
	quantidade INTEGER NOT NULL,
	preco_unitario DECIMAL(12, 2) NOT NULL,
	PRIMARY KEY (id_pedido, id_produto),
	CONSTRAINT fk_item_pedido_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
	CONSTRAINT fk_item_pedido_produto FOREIGN KEY (id_produto) REFERENCES produto (id_produto),
	CONSTRAINT ck_item_quantidade CHECK (quantidade > 0),
	CONSTRAINT ck_item_preco CHECK (preco_unitario >= 0)
);

-------- 4. Pagamento e entrega
CREATE TABLE pagamento (
	id_pagamento INTEGER IDENTITY(1,1) PRIMARY KEY,
	id_pedido INTEGER NOT NULL UNIQUE,
	forma VARCHAR(20) NOT NULL,
	status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
	valor DECIMAL(12, 2) NOT NULL,
	data_pagamento DATETIME,
	CONSTRAINT fk_pagamento_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
	CONSTRAINT ck_pagamento_forma CHECK (forma IN ('PIX', 'CARTAO', 'BOLETO')),
	CONSTRAINT ck_pagamento_status CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO', 'ESTORNADO')),
	CONSTRAINT ck_pagamento_valor CHECK (valor >= 0)
);

CREATE TABLE entrega (
	id_entrega INTEGER IDENTITY(1,1) PRIMARY KEY,
	id_pedido INTEGER NOT NULL UNIQUE,
	codigo_rastreio VARCHAR(60) UNIQUE,
	transportadora VARCHAR(100),
	data_envio DATE,
	data_entrega DATE,
	CONSTRAINT fk_entrega_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
	CONSTRAINT ck_entrega_datas CHECK (data_entrega IS NULL OR data_envio IS NULL OR data_entrega >= data_envio)
);

-------- Índices para consultas frequentes
CREATE INDEX idx_endereco_cliente ON endereco (id_cliente);
CREATE INDEX idx_pedido_cliente ON pedido (id_cliente);
CREATE INDEX idx_pedido_status ON pedido (status);
CREATE INDEX idx_item_pedido_produto ON item_pedido (id_produto);
