USE loja_quadros;
GO

-- Conta do usuário: endereços podem ser "excluídos" sem sumir do histórico dos pedidos.
-- Pode ser executado mais de uma vez. Rode DEPOIS do 03_pedidos.sql.

-- ativo = 'N' esconde o endereço da conta, mas os pedidos antigos continuam apontando para ele.
IF COL_LENGTH('endereco', 'ativo') IS NULL
	ALTER TABLE endereco ADD ativo CHAR(1) NOT NULL
		CONSTRAINT df_endereco_ativo DEFAULT 'S'
		CONSTRAINT ck_endereco_ativo CHECK (ativo IN ('S', 'N'));
GO
