USE loja_quadros;
GO

-- Recuperação de senha, favoritos e data de nascimento.
-- Pode ser executado mais de uma vez. Rode DEPOIS do 04_conta.sql.

IF COL_LENGTH('cliente', 'data_nascimento') IS NULL
	ALTER TABLE cliente ADD data_nascimento DATE NULL;
GO

-- Obras favoritas de cada pessoa (antes ficavam só no navegador)
IF OBJECT_ID('favorito', 'U') IS NULL
	CREATE TABLE favorito (
		id_cliente INTEGER NOT NULL,
		id_produto INTEGER NOT NULL,
		data_criacao DATETIME NOT NULL CONSTRAINT df_favorito_data DEFAULT GETDATE(),
		CONSTRAINT pk_favorito PRIMARY KEY (id_cliente, id_produto),
		CONSTRAINT fk_favorito_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
		CONSTRAINT fk_favorito_produto FOREIGN KEY (id_produto) REFERENCES produto (id_produto)
	);
GO

-- Links de "esqueci minha senha". Guardamos só o hash do código (SHA-256): quem lê o banco não consegue usar o link.
IF OBJECT_ID('redefinicao_senha', 'U') IS NULL
	CREATE TABLE redefinicao_senha (
		id_redefinicao INTEGER IDENTITY(1,1) PRIMARY KEY,
		id_cliente INTEGER NOT NULL,
		token_hash CHAR(64) NOT NULL UNIQUE,
		data_expiracao DATETIME NOT NULL,
		usado CHAR(1) NOT NULL CONSTRAINT df_redefinicao_usado DEFAULT 'N' CONSTRAINT ck_redefinicao_usado CHECK (usado IN ('S', 'N')),
		CONSTRAINT fk_redefinicao_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente)
	);
GO
