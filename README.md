# Nambá Galerie

Plataforma de e-commerce para venda de quadros prontos e personalizados, com curadoria de artistas.
## LINK DO SITE NA WEB: https://nambagalerie.vercel.app

> **Projeto de demonstração:** nenhum pagamento é cobrado de verdade. O pagamento é simulado e o frete é R$ 0.
> Na primeira visita depois de um tempo parado, o site pode levar até 1 minuto para carregar (a API gratuita "dorme" quando ninguém usa).

## 📋 Sobre o Projeto

Sistema desenvolvido para que artistas apresentem e vendam suas obras, compradores encontrem e reservem quadros únicos, e a curadoria aprove quem pode vender.

O sistema atende três perfis principais:

- **Comprador** — navega pela vitrine, favorita obras, monta o carrinho, faz o pedido e acompanha "meus pedidos".
- **Artista** — cadastra-se com portfólio, publica obras depois de aprovado, edita ou despublica, e acompanha as vendas e os envios.
- **Administrador (curadoria)** — aprova ou rejeita artistas, despublica obras, vê todos os pedidos e os relatórios.

## 🎯 Destaques

- **Cada obra é única.** Comprar reserva a única unidade e a obra sai da vitrine. Se duas pessoas tentarem ao mesmo tempo, só uma consegue.
- **O servidor decide o preço.** O front envia só os IDs das obras; o total vem do banco.
- **Pedido com prazo.** Se não for pago em 24 h, o pedido expira e a obra volta à vitrine.
- **Segurança:** senhas com Argon2, sessão em cookie HttpOnly, bloqueio de tentativas de login, proteção contra CSRF, validação de CPF e conferência do conteúdo das imagens.
- **Recuperação de senha** por e-mail, com link de uso único válido por 60 minutos.

## 🛠 Tecnologias

- Python 3 + FastAPI (API)
- SQLAlchemy + PostgreSQL (Supabase)
- React 19 + TypeScript + Vite (front-end)
- pytest (back-end) e Vitest + Testing Library (front-end)
- GitHub Actions (CI)
- Supabase Storage (imagens das obras)
- Brevo (envio de e-mail)

## 📁 Estrutura do Projeto

```
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── routers/          # rotas da API
│   ├── tests/            # testes automáticos
│   ├── scripts/          # create_admin.py, smoke_postgres.py, test_email.py
│   ├── main.py
│   ├── models.py
│   ├── seed.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── screens/      # uma tela por arquivo
│       ├── components/
│       ├── api.ts        # único ponto de contato com a API
│       └── mock.ts       # modo simulado (sem back-end)
├── sql/
│   └── postgres/
│       ├── 01_schema.sql
│       └── 02_supabase.sql
└── README.md
```

A pasta `sql/` também guarda os scripts antigos do SQL Server (`00` a `05`), só como histórico.

## 🚀 Como Executar

### Backend

Pré-requisitos:
- Python 3
- PostgreSQL rodando localmente (ou um projeto no Supabase) com o banco `loja_quadros` criado

```bash
cd backend

# Criar as tabelas
psql -U postgres -d loja_quadros -f ../sql/postgres/01_schema.sql

# Configurar variáveis (preencha DATABASE_URL e JWT_SECRET)
cp .env.example .env

# Instalar e rodar
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py                 # dados de exemplo (só em desenvolvimento)
uvicorn main:app --reload
```

URL local: `http://localhost:8000/health`

Detalhes (Docker, Supabase, e-mail, administrador): [backend/README.md](backend/README.md)

### Frontend

Pré-requisitos:
- Node.js 20+
- Backend rodando localmente (ou use o modo simulado)

```bash
cd frontend
npm install
npm run dev
```

URL local: `http://localhost:5173`

Para demonstrar sem back-end, crie `frontend/.env.local` com `VITE_USE_MOCK=true`.

Detalhes: [frontend/README.md](frontend/README.md)

## 🧪 Testes

```bash
# Back-end (usa SQLite temporário, não toca no PostgreSQL)
cd backend && pip install -r requirements-dev.txt && pytest

# Front-end
cd frontend && npm test
```

- **100 testes** no back-end e **31 testes** no front-end.
- `scripts/smoke_postgres.py` roda um teste ponta a ponta contra a API e o PostgreSQL reais, incluindo corridas de duas pessoas comprando a mesma obra.
- O CI roda os testes e o build a cada push na `main`.

## 🔌 Endpoints REST

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Confere a conexão com o banco |
| POST | `/auth/login` | Entrar |
| POST | `/auth/logout` | Sair |
| POST | `/auth/forgot-password` | Pedir link de nova senha |
| POST | `/auth/reset-password` | Definir nova senha pelo link |
| GET | `/me` | Dados de quem está logado |
| POST | `/users` | Cadastro (comprador ou artista com portfólio) |
| GET | `/artworks` | Listar obras da vitrine |
| POST | `/artworks` | Cadastrar obra (artista aprovado) |
| PATCH | `/artworks/{id}` | Editar obra |
| DELETE | `/artworks/{id}` | Excluir obra |
| GET | `/artists?status=pending` | Candidatos a artista (admin) |
| PATCH | `/artists/{id}` | Aprovar ou rejeitar artista (admin) |
| GET | `/artists/public` | Artistas aprovados |
| POST | `/orders` | Criar pedido (reserva as obras) |
| GET | `/orders` | Meus pedidos |
| POST | `/orders/{id}/cancel` | Cancelar pedido |
| POST | `/orders/{id}/ship` | Marcar como enviado, com rastreio |
| POST | `/orders/{id}/deliver` | Marcar como entregue |
| GET | `/sales` | Vendas do artista |
| GET | `/admin/orders` | Todos os pedidos (admin) |
| GET | `/admin/reports` | Relatórios (admin) |
| GET | `/favorites` | Obras favoritas |

Lista completa, com quem pode acessar cada rota: [backend/README.md](backend/README.md#rotas)

## 🏗 Arquitetura

### Front-end
`GalerieApp.tsx` guarda o estado (usuário, carrinho, tema) e escolhe a tela. Cada tela fica em `screens/`. Todo acesso a dados passa por `api.ts`, que fala com a API ou usa o modo simulado.

### Back-end
- `routers/` — rotas por assunto (autenticação, obras, artistas, pedidos, conta, admin)
- `models.py` — tabelas do banco
- `orders_service.py` — regras de reserva, expiração e cancelamento de pedidos
- `validators.py` — CPF, CEP, preço, medidas e ano
- `security.py` — senhas, sessão e bloqueio de tentativas
- `uploads.py` — validação e envio das imagens para o Supabase Storage

## 🚢 Deploy

- **Frontend:** Vercel — `https://nambagalerie.vercel.app`
- **Backend:** Render — `https://namba-galerie-api.onrender.com`
- **Banco de dados e imagens:** Supabase (PostgreSQL + Storage)

## 🔭 Próximos passos

- Pagamento real (gateway como Mercado Pago ou Stripe)
- Cálculo de frete e retirada
- Rastreio de envio integrado

## 👥 Integrantes

| Nome | GitHub |
|---|---|
| Gabriel Tupinambá de Carvalho | Gabrieltupi19072008 |
| Ruan Guilherme | Ruan-GS |

---

Disciplina: Engenharia de Software
