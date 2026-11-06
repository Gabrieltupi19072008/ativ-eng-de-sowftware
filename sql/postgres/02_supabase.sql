-- Ajustes só para o SUPABASE. Rode DEPOIS do 01_schema.sql. Pode ser executado mais de uma vez.
--
-- 1) RLS (bloqueio por linha) em todas as tabelas. O Supabase expõe o schema "public" por uma API pública (PostgREST):
--    sem RLS, quem tivesse a chave pública leria e alteraria tudo (inclusive os hashes de senha).
--    Sem nenhuma política, a API pública não enxerga nada. A nossa API (FastAPI) conecta pelo usuário "postgres",
--    que ignora o RLS, então o site continua funcionando normalmente.
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE endereco ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_imagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_imagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorito ENABLE ROW LEVEL SECURITY;
ALTER TABLE redefinicao_senha ENABLE ROW LEVEL SECURITY;

-- 2) Pasta de imagens das obras: pública para leitura (as fotos aparecem no site), mas só a nossa API consegue enviar ou apagar
--    (ela usa a chave "service_role"). Limites: 10 MB por arquivo e só JPG, PNG ou WEBP.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('obras', 'obras', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
