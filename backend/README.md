# Back-end — API Loja de Quadros (FastAPI + PostgreSQL)

## O que já está pronto
Login e sessão, cadastro (comprador e artista com portfólio), vitrine de obras, cadastro de obras, aprovação de artistas pela curadoria,
**pedidos com controle de estoque** (compra, cancelamento, expiração e "meus pedidos").
**Ainda não existe:** pagamento de verdade (gateway), cálculo de frete e retirada, envio/rastreio. Hoje o frete é R$ 0 e o pagamento é simulado.

## Rodar pela primeira vez

1. **Banco de dados** (PostgreSQL). Um único script cria tudo: `sql/postgres/01_schema.sql` (pode ser rodado mais de uma vez).
   Os scripts antigos do SQL Server (`sql/00` a `sql/05`) ficam na pasta só como histórico.
   - **Mais simples para desenvolver: contêiner Docker** (no Mac use o Colima, sem precisar de senha de administrador):
     ```bash
     brew install colima docker
     colima start --vm-type vz --cpu 2 --memory 4 --disk 20      # Apple Silicon
     docker run -d --name postgres-namba -e POSTGRES_PASSWORD='SUA_SENHA' -e POSTGRES_DB=loja_quadros -e TZ=America/Sao_Paulo \
       -p 127.0.0.1:5433:5432 -v postgres-namba-data:/var/lib/postgresql/data postgres:16
     docker exec -i postgres-namba psql -U postgres -d loja_quadros -v ON_ERROR_STOP=1 < sql/postgres/01_schema.sql
     ```
     (Usamos a porta 5433 para não esbarrar num PostgreSQL que você já tenha na 5432.) Nas próximas vezes: `colima start` e `docker start postgres-namba`.
   - **Ou use o Supabase** (banco na internet, plano grátis): crie um projeto, abra o *SQL Editor*, cole o conteúdo de `sql/postgres/01_schema.sql` e execute.
     Na `DATABASE_URL` use a *Connection string* do painel na opção **Session pooler** (funciona em IPv4).
2. **Variáveis**: `cp .env.example .env` e preencha `DATABASE_URL` e `JWT_SECRET`
   (gere com `python -c "import secrets; print(secrets.token_urlsafe(48))"`). O `.env` nunca vai para o GitHub.
   Defina também `TZ=America/Sao_Paulo`: as datas do pedido usam o horário de Brasília.
3. **Atenção:** o PostgreSQL diferencia maiúsculas de minúsculas em textos (o SQL Server não). A API grava e-mails em minúsculas, e o esquema tem um índice que impede e-mails repetidos mesmo com letras diferentes.
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
| `POST /orders/{id}/ship` | artista (dono de todas as obras) ou admin | Pedido pago vira "enviado" com código de rastreio (JSON `{trackingCode, carrier?}`; código único) |
| `POST /orders/{id}/deliver` | artista (dono de todas as obras) ou admin | Pedido enviado vira "entregue" |
| `GET /sales` | artista ou admin | Obras vendidas/reservadas do artista (admin vê todas); o endereço só aparece depois do pagamento |
| `GET /admin/orders`, `GET /admin/reports` | admin | Todos os pedidos e os números dos relatórios |
| `PATCH /artworks/{id}`, `DELETE /artworks/{id}` | artista dono | Edita (ou salva como rascunho) e exclui; obra reservada/vendida não muda; excluir só se nunca esteve em pedido |
| `PATCH /artworks/{id}/visibility` | admin | Despublica/republica uma obra (`{visible: bool}`) |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | todos | "Esqueci minha senha": envia um link (vale 60 min, uso único, guardado só como hash). Resposta igual exista a conta ou não; 5 pedidos/15 min. Sem `SMTP_HOST` o e-mail aparece no terminal da API |
| `GET /favorites`, `POST/DELETE /favorites/{id}` | logado | Obras favoritas da pessoa |
| `GET /artists/public` | todos | Artistas aprovados com obra à venda (só dados públicos), para a página "Artistas" |
| `PATCH /me`, `POST /me/password` | logado | Dados pessoais e troca de senha (exige a senha atual; 5 erros bloqueiam por 15 min) |
| `GET/POST /me/addresses`, `PATCH/DELETE /me/addresses/{id}` | logado | Endereços de entrega (excluir só esconde; editar endereço já usado em pedido cria um novo) |
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
pytest                                  # rápido, usa SQLite temporário e não toca no PostgreSQL
python scripts/smoke_postgres.py        # ponta a ponta contra a API + PostgreSQL reais (API no ar e seed rodado)
```
O `smoke_postgres.py` cadastra comprador e artista, aprova, publica obra, faz pedidos, cancela, paga e vence pedidos, e roda **5 corridas de duas pessoas comprando a mesma obra ao mesmo tempo** (só uma pode vencer). Ao final **apaga** o que criou (contas `@example.com`).

## Limitações conhecidas
- O bloqueio de tentativas fica na memória do processo: com vários servidores ou reinício, ele zera.
- O `pytest` roda em SQLite. O PostgreSQL 16 foi validado com o `smoke_postgres.py` (contêiner Docker no Apple Silicon): o esquema `sql/postgres/01_schema.sql`, o `seed.py` e todas as rotas atuais funcionaram (63 verificações).
- Para o front em outro domínio (produção), use `COOKIE_SECURE=true` e `COOKIE_SAMESITE=none` e HTTPS.

## E-mail (recuperação de senha)

Sem `BREVO_API_KEY` nem `SMTP_HOST` no `.env`, o e-mail **não é enviado**: em desenvolvimento o texto (com o link) aparece no terminal da API.
**Recomendado: Brevo (API por HTTPS).** Plano grátis; basta verificar um e-mail remetente (um Gmail serve), sem domínio próprio, e funciona em hospedagens que bloqueiam SMTP. No `.env`: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (o e-mail verificado em Brevo > Senders) e `BREVO_SENDER_NAME`. Se houver chave do Brevo, ela tem prioridade sobre o SMTP.
Alternativa SMTP: preencha no `backend/.env` (modelo no `.env.example`): `SMTP_HOST`, `SMTP_PORT` (587 usa STARTTLS, 465 usa SSL), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
Exemplo com Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=seu@gmail.com`, `SMTP_PASSWORD=` a **senha de app** de 16 letras (não a senha normal; exige verificação em duas etapas ligada na conta Google).
Teste o envio sem criar conta: `.venv/bin/python scripts/test_email.py seu@email.com` (mostra o motivo se falhar). Reinicie a API depois de mexer no `.env`.
