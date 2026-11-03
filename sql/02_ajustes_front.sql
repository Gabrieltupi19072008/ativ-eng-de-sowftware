USE loja_quadros;
GO

-- Necessário para criar o índice filtrado do CPF (o sqlcmd vem com isto desligado)
SET QUOTED_IDENTIFIER ON;
GO

-- Ajustes para o front-end React (perfis, aprovação de artistas, portfólio e detalhes da obra).
-- Pode ser executado mais de uma vez: cada alteração só acontece se ainda não existir.
-- Rode DEPOIS do 01_schema.sql.

-------- 1. Cliente: perfil, dados do artista e revisão da curadoria
IF COL_LENGTH('cliente', 'papel') IS NULL
	ALTER TABLE cliente ADD papel VARCHAR(10) NOT NULL
		CONSTRAINT df_cliente_papel DEFAULT 'COMPRADOR'
		CONSTRAINT ck_cliente_papel CHECK (papel IN ('COMPRADOR', 'ARTISTA', 'ADMIN'));
GO

IF COL_LENGTH('cliente', 'status_artista') IS NULL
	ALTER TABLE cliente ADD status_artista VARCHAR(20) NOT NULL
		CONSTRAINT df_cliente_status_artista DEFAULT 'NAO_APLICAVEL'
		CONSTRAINT ck_cliente_status_artista CHECK (status_artista IN ('NAO_APLICAVEL', 'PENDENTE', 'APROVADO', 'REJEITADO'));
GO

IF COL_LENGTH('cliente', 'cpf') IS NULL
	ALTER TABLE cliente ADD cpf CHAR(11) NULL;
GO

IF COL_LENGTH('cliente', 'cidade') IS NULL
	ALTER TABLE cliente ADD cidade VARCHAR(80) NULL;
GO

IF COL_LENGTH('cliente', 'estado') IS NULL
	ALTER TABLE cliente ADD estado CHAR(2) NULL;
GO

IF COL_LENGTH('cliente', 'estilo_artistico') IS NULL
	ALTER TABLE cliente ADD estilo_artistico VARCHAR(80) NULL;
GO

IF COL_LENGTH('cliente', 'observacao_revisao') IS NULL
	ALTER TABLE cliente ADD observacao_revisao VARCHAR(500) NULL;
GO

IF COL_LENGTH('cliente', 'id_revisor') IS NULL
	ALTER TABLE cliente ADD id_revisor INTEGER NULL
		CONSTRAINT fk_cliente_revisor FOREIGN KEY REFERENCES cliente (id_cliente);
GO

IF COL_LENGTH('cliente', 'data_revisao') IS NULL
	ALTER TABLE cliente ADD data_revisao DATETIME NULL;
GO

-- CPF único, mas só entre quem informou (contas de teste ficam sem CPF)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_cliente_cpf' AND object_id = OBJECT_ID('cliente'))
	CREATE UNIQUE INDEX ux_cliente_cpf ON cliente (cpf) WHERE cpf IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cliente_artista_status' AND object_id = OBJECT_ID('cliente'))
	CREATE INDEX idx_cliente_artista_status ON cliente (papel, status_artista);
GO

-------- 2. Produto: detalhes da obra e rascunho
IF COL_LENGTH('produto', 'ano') IS NULL
	ALTER TABLE produto ADD ano SMALLINT NULL;
GO

IF COL_LENGTH('produto', 'largura_cm') IS NULL
	ALTER TABLE produto ADD largura_cm DECIMAL(8, 2) NULL;
GO

IF COL_LENGTH('produto', 'altura_cm') IS NULL
	ALTER TABLE produto ADD altura_cm DECIMAL(8, 2) NULL;
GO

IF COL_LENGTH('produto', 'status') IS NULL
	ALTER TABLE produto ADD status VARCHAR(10) NOT NULL
		CONSTRAINT df_produto_status DEFAULT 'PUBLICADA'
		CONSTRAINT ck_produto_status CHECK (status IN ('PUBLICADA', 'RASCUNHO'));
GO

-------- 3. Novas tabelas: fotos da obra e portfólio do artista
IF OBJECT_ID('produto_imagem', 'U') IS NULL
CREATE TABLE produto_imagem (
	id_imagem INTEGER IDENTITY(1,1) PRIMARY KEY,
	id_produto INTEGER NOT NULL,
	url VARCHAR(255) NOT NULL,
	ordem SMALLINT NOT NULL DEFAULT 0,
	CONSTRAINT fk_produto_imagem_produto FOREIGN KEY (id_produto) REFERENCES produto (id_produto)
);
GO

IF OBJECT_ID('portfolio_imagem', 'U') IS NULL
CREATE TABLE portfolio_imagem (
	id_imagem INTEGER IDENTITY(1,1) PRIMARY KEY,
	id_cliente INTEGER NOT NULL,
	url VARCHAR(255) NOT NULL,
	ordem SMALLINT NOT NULL DEFAULT 0,
	CONSTRAINT fk_portfolio_imagem_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_produto_imagem_produto' AND object_id = OBJECT_ID('produto_imagem'))
	CREATE INDEX idx_produto_imagem_produto ON produto_imagem (id_produto);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_portfolio_imagem_cliente' AND object_id = OBJECT_ID('portfolio_imagem'))
	CREATE INDEX idx_portfolio_imagem_cliente ON portfolio_imagem (id_cliente);
GO

-------- 4. Categorias = técnicas usadas nos filtros da loja
INSERT INTO categoria (nome, descricao)
SELECT v.nome, v.descricao
FROM (VALUES
	('Óleo', 'Pintura a óleo'),
	('Aquarela', 'Pintura em aquarela'),
	('Acrílica', 'Pintura em tinta acrílica'),
	('Pastel', 'Pastel seco ou oleoso'),
	('Arte Digital', 'Criação e impressão digital'),
	('Técnica Mista', 'Combinação de técnicas')
) AS v (nome, descricao)
WHERE NOT EXISTS (SELECT 1 FROM categoria c WHERE c.nome = v.nome);
GO
