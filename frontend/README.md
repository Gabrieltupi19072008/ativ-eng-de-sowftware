# Nambá Galerie — Front-end (React + Vite)

## Rodar
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # checa tipos e gera /dist
```
Requer Node 20+.

## Contas de teste (simuladas, definidas em `src/api.ts`)
| Perfil | E-mail | Senha |
|---|---|---|
| Comprador | comprador@nambagalerie.com | comprador@123 |
| Comerciante (artista aprovado) | comerciante@nambagalerie.com | comerciante@123 |
| Administrador | admin@nambagalerie.com | nambagalerie@ |

Servem só para testar localmente; troque quando o back-end real existir.

## Estrutura
- `src/GalerieApp.tsx` — telas (login, cadastro, loja, conta, painel ADM, carrinho)
- `src/styles.css` — estilos (inclui a animação de rolagem da capa → login)
- `src/api.ts` — **único ponto de contato com os dados**
- `src/data/seed.ts` — obras e artistas de exemplo

## Ligar ao back-end Python
Hoje `src/api.ts` simula tudo no `localStorage`. Para usar a API real, troque o corpo de cada função por `fetch(`${API_URL}/...`)`
(`API_URL` vem de `VITE_API_URL`, padrão `http://localhost:8000`) mantendo as mesmas assinaturas:

| Função | Endpoint sugerido |
|---|---|
| `loginAction` / `logoutAction` | `POST /auth/login`, `POST /auth/logout` |
| `registerAction` | `POST /users` |
| `currentUser` | `GET /me` |
| `listArtworks` / `createArtworkAction` | `GET /artworks`, `POST /artworks` |
| `listCandidates` / `reviewArtistAction` | `GET /artists?status=pending`, `PATCH /artists/{id}` |

O Python precisa liberar CORS para `http://localhost:5173`.
