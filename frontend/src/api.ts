// Camada de dados do front-end: único ponto de contato com o back-end.
//
// Por padrão fala com a API em Python (VITE_API_URL, padrão http://localhost:8000).
// Com VITE_USE_MOCK=true usa a versão simulada no navegador (src/mock.ts), útil sem back-end.
import type { AdminOrderView, Address, ArtistCandidate, ArtworkView, OrderView, PaymentMethod, ReportsView, SaleView, UserView } from './GalerieApp'
import { DEMO_ACCOUNTS } from './demoAccounts'
import * as mock from './mock'

export const API_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// order e unavailable só vêm nas ações de pedido (unavailable = ids de obras que já não estão à venda)
export type ActionResult = { ok: boolean; message: string; field?: string; order?: OrderView; unavailable?: string[] }
export type OrderInput = { items: string[]; address: Address; paymentMethod: PaymentMethod }

const OFFLINE: ActionResult = { ok: false, message: 'Não foi possível conectar ao servidor. Tente novamente em instantes.' }

// credentials: 'include' faz o navegador enviar o cookie de sessão (HttpOnly) a cada chamada.
async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, { credentials: 'include', ...init })
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// Leituras: se a rede falhar o erro sobe e o App mostra "Não foi possível conectar".
async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Erro ${response.status}`)
  return response.json() as Promise<T>
}

// Ações: nunca lançam erro; devolvem { ok, message, field? } para a tela mostrar.
async function action(path: string, init: RequestInit): Promise<ActionResult> {
  try {
    const response = await call(path, init)
    const body = await response.json().catch(() => null)
    if (body && typeof body.message === 'string') {
      return { ok: Boolean(body.ok), message: body.message, field: body.field, order: body.order, unavailable: body.unavailable }
    }
    return { ok: false, message: `Erro inesperado do servidor (${response.status}).` }
  } catch {
    return OFFLINE
  }
}

// ---------- CEP ----------
export type CepAddress = { street: string; neighborhood: string; city: string; state: string }

// Consulta pública e gratuita (ViaCEP), direto do navegador. Devolve null quando o CEP não existe.
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '')
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!response.ok) throw new Error('Falha ao consultar o CEP')
  const data = await response.json()
  if (data.erro) return null
  return { street: data.logradouro ?? '', neighborhood: data.bairro ?? '', city: data.localidade ?? '', state: data.uf ?? '' }
}

// ---------- leitura ----------
async function apiCurrentUser(): Promise<UserView | null> {
  const response = await call('/me')
  if (response.status === 401) return null
  return readJson<UserView>(response)
}

// A API devolve null onde não há valor; o front usa undefined.
type ApiArtwork = Omit<ArtworkView, 'year' | 'width' | 'height'> & { year: number | null; width: number | null; height: number | null }

async function apiListArtworks(): Promise<ArtworkView[]> {
  const items = await readJson<ApiArtwork[]>(await call('/artworks'))
  return items.map((art) => ({ ...art, year: art.year ?? undefined, width: art.width ?? undefined, height: art.height ?? undefined }))
}

async function apiListCandidates(): Promise<ArtistCandidate[]> {
  const response = await call('/artists?status=pending')
  if (response.status === 401 || response.status === 403) return [] // só o administrador vê a fila
  return readJson<ArtistCandidate[]>(response)
}

// ---------- ações ----------
function apiLogin(data: FormData): Promise<ActionResult> {
  return action('/auth/login', { method: 'POST', ...json({ email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') }) })
}

async function apiDemoLogin(role: 'buyer' | 'artist' | 'admin'): Promise<ActionResult> {
  const { email, password } = DEMO_ACCOUNTS[role]
  const result = await action('/auth/login', { method: 'POST', ...json({ email, password }) })
  if (result.ok) return { ok: true, message: 'Modo de demonstração iniciado.' }
  return result.message === OFFLINE.message
    ? result
    : { ok: false, message: 'As contas de demonstração ainda não foram criadas no banco. Rode "python seed.py" no back-end.' }
}

const apiLogout = () => action('/auth/logout', { method: 'POST' })

// O FormData do formulário segue direto (multipart), inclusive os arquivos de imagem.
const apiRegister = (data: FormData) => action('/users', { method: 'POST', body: data })
const apiCreateArtwork = (data: FormData) => action('/artworks', { method: 'POST', body: data })

const apiReviewArtist = (artistId: string, decision: 'approved' | 'rejected', note: string) =>
  action(`/artists/${encodeURIComponent(artistId)}`, { method: 'PATCH', ...json({ decision, note }) })

async function apiListOrders(): Promise<OrderView[]> {
  return readJson<OrderView[]>(await call('/orders'))
}

const apiListSales = async () => readJson<SaleView[]>(await call('/sales'))
const apiListAdminOrders = async () => readJson<AdminOrderView[]>(await call('/admin/orders'))
const apiGetReports = async () => readJson<ReportsView>(await call('/admin/reports'))

const apiCreateOrder = (input: OrderInput) => action('/orders', { method: 'POST', ...json(input) })
const apiCancelOrder = (id: string) => action(`/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
const apiSimulatePayment = (id: string) => action(`/orders/${encodeURIComponent(id)}/simulate-payment`, { method: 'POST' })

// ---------- o que o resto do app usa ----------
export const currentUser: () => Promise<UserView | null> = USE_MOCK ? mock.currentUser : apiCurrentUser
export const listArtworks: () => Promise<ArtworkView[]> = USE_MOCK ? mock.listArtworks : apiListArtworks
export const listCandidates: () => Promise<ArtistCandidate[]> = USE_MOCK ? mock.listCandidates : apiListCandidates
export const loginAction: (data: FormData) => Promise<ActionResult> = USE_MOCK ? mock.loginAction : apiLogin
export const demoLoginAction: (role: 'buyer' | 'artist' | 'admin') => Promise<ActionResult> = USE_MOCK ? mock.demoLoginAction : apiDemoLogin
export const logoutAction: () => Promise<ActionResult> = USE_MOCK ? mock.logoutAction : apiLogout
export const registerAction: (data: FormData) => Promise<ActionResult> = USE_MOCK ? mock.registerAction : apiRegister
export const createArtworkAction: (data: FormData) => Promise<ActionResult> = USE_MOCK ? mock.createArtworkAction : apiCreateArtwork
export const reviewArtistAction: (id: string, decision: 'approved' | 'rejected', note: string) => Promise<ActionResult> = USE_MOCK ? mock.reviewArtistAction : apiReviewArtist
export const listOrders: () => Promise<OrderView[]> = USE_MOCK ? mock.listOrders : apiListOrders
export const createOrderAction: (input: OrderInput) => Promise<ActionResult> = USE_MOCK ? mock.createOrderAction : apiCreateOrder
export const cancelOrderAction: (id: string) => Promise<ActionResult> = USE_MOCK ? mock.cancelOrderAction : apiCancelOrder
export const simulatePaymentAction: (id: string) => Promise<ActionResult> = USE_MOCK ? mock.simulatePaymentAction : apiSimulatePayment
export const listSales: () => Promise<SaleView[]> = USE_MOCK ? mock.listSales : apiListSales
export const listAdminOrders: () => Promise<AdminOrderView[]> = USE_MOCK ? mock.listAdminOrders : apiListAdminOrders
export const getReports: () => Promise<ReportsView> = USE_MOCK ? mock.getReports : apiGetReports
