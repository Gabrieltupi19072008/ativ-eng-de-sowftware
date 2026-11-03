USE loja_quadros;
GO

-- Necessário para criar índices filtrados (o sqlcmd vem com isto desligado)
SET QUOTED_IDENTIFIER ON;
GO

-- Pedidos: envio ou retirada, e prazo para pagar (depois dele o pedido é cancelado e a obra volta ao estoque).
-- Pode ser executado mais de uma vez. Rode DEPOIS do 02_ajustes_front.sql.

-- ENVIO é o único tipo em uso por enquanto; RETIRADA (mesma cidade) fica previsto para quando o frete for implementado.
IF COL_LENGTH('pedido', 'tipo_entrega') IS NULL
	ALTER TABLE pedido ADD tipo_entrega VARCHAR(10) NOT NULL
		CONSTRAINT df_pedido_tipo_entrega DEFAULT 'ENVIO'
		CONSTRAINT ck_pedido_tipo_entrega CHECK (tipo_entrega IN ('ENVIO', 'RETIRADA'));
GO

IF COL_LENGTH('pedido', 'data_expiracao') IS NULL
	ALTER TABLE pedido ADD data_expiracao DATETIME NULL;
GO

-- Acelera a busca de pedidos vencidos e o "Meus pedidos"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_pedido_status_expiracao' AND object_id = OBJECT_ID('pedido'))
	CREATE INDEX idx_pedido_status_expiracao ON pedido (status, data_expiracao);
GO

-- Atenção: o estoque já tem CHECK (quantidade >= 0), que impede vender além do que existe mesmo se houver falha no código.
