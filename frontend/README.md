# Nambá Galerie — Front-end (React + Vite)

## Rodar
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # checa tipos e gera /dist
npm test         # testes automáticos (rodam no modo simulado, sem back-end)
```
Requer Node 20+.

Opcional: para apontar para a API Python, copie `.env.example` para `.env.local` e ajuste `VITE_API_URL`.
O `.env.local` não vai para o GitHub.

## Dois modos de uso
| Modo | Como ligar | Para quê |
|---|---|---|
| **Com a API em Python** (padrão) | subir o back-end (veja o README dele) em `http://localhost:8000` | uso real: dados no banco SQL |
| **Simulado** | criar `.env.local` com `VITE_USE_MOCK=true` | demonstrar sem back-end: tudo fica no navegador (localStorage) |

Se a API estiver fora do ar, o site mostra "Não foi possível conectar" com o botão **Tentar novamente**.
Mude o endereço da API com `VITE_API_URL` (veja `.env.example`). Depois de mexer no `.env.local`, reinicie o `npm run dev`.

## Contas de teste (em `src/demoAccounts.ts`)
No modo simulado elas já existem. Com a API, são criadas pelo `python seed.py` do back-end.

| Perfil | E-mail | Senha |
|---|---|---|
| Comprador | comprador@nambagalerie.com | comprador@123 |
| Comerciante (artista aprovado) | comerciante@nambagalerie.com | comerciante@123 |
| Administrador | admin@nambagalerie.com | nambagalerie@ |

Servem só para desenvolvimento; os botões de acesso rápido do login usam estas contas.
No cadastro, o CPF é validado de verdade pelo back-end (exemplo válido para testar: `529.982.247-25`).

## Testes automáticos

Ficam em `src/test/`. Abrem o app inteiro num navegador simulado (jsdom) com a API simulada (`src/mock.ts`) e fazem o que a pessoa faria: entrar, pedir recuperação de senha, trocar a senha pelo link. O CI do GitHub (`.github/workflows/ci.yml`) roda estes testes, o `pytest` do back-end e o build a cada push na `main`.

## Estrutura
- `src/GalerieApp.tsx` — o "maestro": guarda o estado (usuário, carrinho, tema) e escolhe qual tela mostrar
- `src/screens/` — uma tela por arquivo: `Login`, `Register`, `Password` (esqueci/nova senha), `Shop` (cabeçalho, vitrine e detalhe da obra), `Browse` (Artistas e Coleções), `Checkout` (carrinho e compra), `AddArtwork`, `Admin` (painel ADM) e `Account`
- `src/screens/account/` — as abas da conta: pedidos, minhas obras, dados pessoais, endereços, segurança e vendas
- `src/components/` — peças usadas em várias telas: `ui.tsx` (botão, ícones, logo), `AddressFields.tsx` (endereço com CEP automático) e `labels.ts` (textos de status)
- `src/types.ts` — os tipos de dados (pedido, obra, usuário, endereço…)
- `src/styles.css` — estilos (inclui a animação de rolagem da capa → login)
- `src/api.ts` — **único ponto de contato com os dados** (fala com a API em Python; escolhe o modo simulado se `VITE_USE_MOCK=true`)
- `src/mock.ts` — versão simulada no navegador (localStorage)
- `src/demoAccounts.ts` — contas de teste
- `src/data/seed.ts` — obras e artistas de exemplo

## Endereço e CEP
No cadastro e no checkout, ao digitar o CEP o front consulta a API pública **ViaCEP** direto do navegador
(`lookupCep` em `src/api.ts`) e preenche rua, bairro, cidade e estado. Falta só o número e o complemento.
Não precisa de back-end. O endereço do cadastro vem preenchido no checkout.
O endereço é salvo como `{ cep, street, number, complement, neighborhood, city, state }`;
a tabela de usuários (ou de endereços) no banco deve ter esses campos.

## Checkout e pagamento (simulação)
O checkout tem 3 etapas (entrega, pagamento, revisão) e uma tela de sucesso, com Pix, boleto e cartão.
**Hoje é só visual: nada é cobrado e os dados do cartão não saem do navegador.**
Para cobrar de verdade será preciso um gateway (Mercado Pago, Stripe etc.):
- o cartão é tokenizado pelo SDK do gateway no navegador, sem passar pelo nosso servidor nem pelo banco;
- o Python cria a cobrança com a chave secreta (guardada em `.env`, fora do GitHub);
- o Pix devolve QR Code e "copia e cola", e o gateway avisa o Python por webhook quando o pagamento cai;
- o valor do pedido é calculado no back-end a partir do preço no banco, nunca enviado pelo React.

## Como o front fala com a API
`src/api.ts` usa `fetch` com `credentials: 'include'`: o login grava um cookie de sessão **HttpOnly** (o JavaScript não lê), e o navegador o envia sozinho a cada chamada.
O back-end precisa liberar CORS para `http://localhost:5173` com credenciais (já está configurado em `CORS_ORIGINS`).

| Função do front | Rota da API |
|---|---|
| `loginAction`, `demoLoginAction` / `logoutAction` | `POST /auth/login` / `POST /auth/logout` |
| `currentUser` | `GET /me` (401 = ninguém logado) |
| `registerAction` | `POST /users` (multipart, com portfólio de imagens) |
| `listArtworks` / `createArtworkAction` | `GET /artworks` / `POST /artworks` (multipart, com imagens) |
| `listCandidates` / `reviewArtistAction` | `GET /artists?status=pending` / `PATCH /artists/{id}` (só administrador) |
| `createOrderAction` | `POST /orders` (só os IDs das obras, o endereço e a forma de pagamento; o preço vem do banco) |
| `listOrders` | `GET /orders` ("Meus pedidos", em Conta → Pedidos) |
| `cancelOrderAction` / `simulatePaymentAction` | `POST /orders/{id}/cancel` / `POST /orders/{id}/simulate-payment` (esta só em desenvolvimento) |

**Pedidos:** ao finalizar a compra o pedido é gravado e a obra fica **reservada** (sai da vitrine) até o pagamento ou o prazo. Se alguém comprar a obra antes, o checkout avisa e tira a obra do carrinho.
Em Conta → Pedidos dá para cancelar e, em desenvolvimento, **simular o pagamento** (nada é cobrado).

**Ainda não existe:** pagamento de verdade, frete e retirada. O frete está em R$ 0 ("Grátis" no checkout) e o botão "Simular pagamento" será trocado por um gateway (Mercado Pago, Stripe etc.), com o cartão tokenizado pelo SDK deles e a chave secreta só no back-end.
