# Back-end — API Loja de Quadros (FastAPI + SQL Server)

## O que já está pronto
Login e sessão, cadastro (comprador e artista com portfólio), vitrine de obras, cadastro de obras, aprovação de artistas pela curadoria,
**pedidos com controle de estoque** (compra, cancelamento, expiração e "meus pedidos").
**Ainda não existe:** pagamento de verdade (gateway), cálculo de frete e retirada, envio/rastreio. Hoje o frete é R$ 0 e o pagamento é simulado.

## Rodar pela primeira vez

1. **Banco de dados** (SQL Server). Execute, nesta ordem, os scripts da pasta `sql/`:
   `00_criar_banco.sql` → `01_schema.sql` → `02_ajustes_front.sql` → `03_pedidos.sql`
   (o `02` e o `03` podem ser rodados de novo sem problema). Pelo terminal:
   ```bash
   cd sql
   for f in 00_criar_banco 01_schema 02_ajustes_front 03_pedidos; do sqlcmd -I -S localhost,1433 -U sa -P 'SUA_SENHA' -C -b -i $f.sql; done
   ```
   O `-I` é importante: sem ele o `sqlcmd` falha ao mexer na tabela `cliente` (o índice único do CPF exige `QUOTED_IDENTIFIER` ligado). A API não tem esse problema.
   - **No Mac não existe SQL Server nativo.** Rode num contêiner. Sem precisar de senha de administrador:
     ```bash
     brew install colima docker
     colima start --vm-type vz --vz-rosetta --cpu 2 --memory 4 --disk 20      # Apple Silicon
     docker run --platform linux/amd64 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='SUA_SENHA' -p 1433:1433 \
       --name sqlserver --restart unless-stopped -v sqlserver-data:/var/opt/mssql -d mcr.microsoft.com/mssql/server:2022-latest
     ```
     (A senha precisa de 8+ caracteres com maiúscula, minúscula, número e símbolo.) Nas próximas vezes: `colima start` e `docker start sqlserver`.
     Alternativa: Docker Desktop, que pede a senha do Mac na instalação.
2. **Driver ODBC**: instale o *ODBC Driver 18 for SQL Server* (o `pyodbc` precisa dele).
   No Mac: `brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release`, depois `brew trust --formula microsoft/mssql-release/msodbcsql18 microsoft/mssql-release/mssql-tools18` e `HOMEBREW_ACCEPT_EULA=Y brew install msodbcsql18 mssql-tools18`.
   Se aparecer `OpenSSL library could not be loaded`: o driver procura o OpenSSL em `/opt/homebrew/opt/openssl`, que no Homebrew novo aponta para a versão 4. Aponte para a 3: `ln -sfn ../Cellar/openssl@3/$(brew list --versions openssl@3 | cut -d' ' -f2) /opt/homebrew/opt/openssl`.
3. **Variáveis**: `cp .env.example .env` e preencha `DB_*` e `JWT_SECRET`
   (gere com `python -c "import secrets; print(secrets.token_urlsafe(48))"`). O `.env` nunca vai para o GitHub.
4. **Dependências**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
5. **Dados de exemplo** (técnicas, contas de teste e obras da vitrine): `python seed.py`
6. **Subir a API**: `uvicorn main:app --reload` → http://localhost:8000
   A documentação interativa (testar as rotas pelo navegador) fica em http://localhost:8000/docs

A API se recusa a subir sem `JWT_SECRET` (assim ninguém esquece de configurar o segredo).

## Contas de teste (criadas pelo `seed.py`, só para desenvolvimento)
| Perfil | E-mail | Senha |
|---|---|---|
| Comprador | comprador@nambagalerie.com | comprador@123 |
| Artista aprovado | comerciante@nambagalerie.com | comerciante@123 |
| Administrador | admin@nambagalerie.com | nambagalerie@ |
| Artistas pendentes (curadoria) | isabela@galerie.demo, diego@galerie.demo | Galerie123! |

O `seed.py` recusa rodar com `ENVIRONMENT=production`. Em produção, crie o administrador de outro jeito e com senha própria.

## Rotas
Erros sempre vêm como `{ "ok": false, "message": "...", "field": "campo" }` (o `field` aponta o campo do formulário com problema).

| Método e rota | Quem pode | O que faz |
|---|---|---|
| `POST /auth/login` | todos | Entra (JSON `{email, password}`) e grava o cookie de sessão |
| `POST /auth/logout` | todos | Sai |
| `GET /me` | logado | Dados de quem está logado (401 se não houver sessão) |
| `POST /users` | todos | Cadastro (formulário multipart). `role`: `buyer` ou `artist`. Artista precisa de `artStyle`, `artistBio` (60+ caracteres) e 2 a 5 imagens em `portfolio`. Já deixa a pessoa logada |
| `GET /artworks` | todos | Obras publicadas. O artista também vê os próprios rascunhos; o admin vê tudo |
| `POST /artworks` | artista aprovado | Cria obra (multipart: `title, technique, description, price, width, height, year, submitType, images`) |
| `GET /artists?status=pending` | admin | Candidatos (`pending`, `approved` ou `rejected`) com portfólio |
| `PATCH /artists/{id}` | admin | Aprova ou rejeita (JSON `{decision: "approved"\|"rejected", note}`). Só cadastros pendentes |
| `POST /orders` | logado | Cria o pedido (JSON `{items: [ids das obras], address, paymentMethod: pix\|boleto\|credit}`). O preço vem do banco, o frete é R$ 0 e **a obra fica reservada** (sai da vitrine) |
| `GET /orders` | logado | "Meus pedidos", do mais novo ao mais antigo |
| `GET /orders/{id}` | dono do pedido ou admin | Um pedido (outra pessoa recebe 404) |
| `POST /orders/{id}/cancel` | dono ou admin | Cancela pedido que ainda aguarda pagamento e devolve as obras à vitrine |
| `POST /orders/{id}/simulate-payment` | dono ou admin | **Só em desenvolvimento** (`FAKE_PAYMENTS`): marca como pago sem cobrar. Será trocado pelo webhook do gateway |
| `GET /health` | todos | Confere a conexão com o banco |

### Como os pedidos funcionam
- **Cada obra é única.** Comprar reserva a única unidade: o estoque cai de 1 para 0 e a obra sai da vitrine. Isso é feito com um `UPDATE` condicional, então se duas pessoas tentarem ao mesmo tempo só uma consegue (a outra recebe 409 com a lista `unavailable`). O pedido inteiro é desfeito se qualquer obra falhar.
- **O servidor decide o preço**: o front envia só os IDs das obras. O total é a soma dos preços do banco.
- **Prazo para pagar** (`ORDER_EXPIRY_HOURS`, padrão 24 h). Depois dele o pedido é cancelado e a obra volta à vitrine. Isso acontece sozinho, ao listar obras ou pedidos, sem agendador.
- Status do pedido: `pending` (aguardando pagamento) → `paid` → `shipped` → `delivered`, ou `cancelled`. Hoje só vão até `paid` (envio vem com o frete).
- Quem vê a obra: visitantes só veem obras à venda; o artista dono vê as próprias com status `reserved` (em pedido não pago) ou `sold`; o admin vê todas.
- O campo `tipo_entrega` do pedido já existe (`ENVIO` / `RETIRADA`); por enquanto só `ENVIO` é aceito.

As imagens enviadas ficam em `backend/uploads/` (fora do Git) e são servidas em `/uploads/...`.
Para produção, o ideal é guardá-las em um serviço de arquivos (S3 etc.).

## Segurança já implementada
- Senhas com **Argon2** (nunca em texto puro). Mensagem e tempo de resposta iguais para e-mail inexistente e senha errada.
- Sessão em **cookie HttpOnly** (o JavaScript não lê) com JWT de 8 horas, `SameSite=Lax`.
- Bloqueio de 5 tentativas de login erradas em 15 minutos (por IP + e-mail).
- **CORS** só para as origens de `CORS_ORIGINS`, e pedidos de escrita vindos de outro site são recusados (CSRF).
- Validação no servidor de e-mail, **CPF (com dígitos verificadores)**, CEP, preço, medidas e ano.
- Imagens: só JPG/PNG/WEBP, conferidas pelo conteúdo do arquivo (não pela extensão), até 10 MB, nome aleatório.
- Ninguém vira administrador nem artista aprovado pelo cadastro.

## Testes
```bash
pip install -r requirements-dev.txt
pytest                                  # rápido, usa SQLite temporário e não toca no SQL Server
python scripts/smoke_sqlserver.py       # ponta a ponta contra a API + SQL Server reais (API no ar e seed rodado)
```
O `smoke_sqlserver.py` cadastra comprador e artista, aprova, publica obra, faz pedidos, cancela, paga e vence pedidos, e roda **5 corridas de duas pessoas comprando a mesma obra ao mesmo tempo** (só uma pode vencer). Ao final **apaga** o que criou (contas `@example.com`).

## Limitações conhecidas
- O bloqueio de tentativas fica na memória do processo: com vários servidores ou reinício, ele zera.
- O `pytest` roda em SQLite. O SQL Server foi validado com o `smoke_sqlserver.py` (SQL Server 2022 em Docker no Apple Silicon): scripts `sql/`, `seed.py` e todas as rotas atuais funcionaram.
- Para o front em outro domínio (produção), use `COOKIE_SECURE=true` e `COOKIE_SAMESITE=none` e HTTPS.
