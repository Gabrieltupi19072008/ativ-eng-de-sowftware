// Modo simulado: tudo no navegador (localStorage), sem back-end.
// Ligado com VITE_USE_MOCK=true. Tem as mesmas funções de api.ts, que escolhe qual usar.
import { seedArtworks, seedCandidates } from './data/seed'
import type { AdminOrderView, ArtistCandidate, ArtworkView, OrderStatus, OrderView, ReportsView, SaleView, UserView } from './GalerieApp'

import type { ActionResult, OrderInput } from './api'
import { DEMO_ACCOUNTS } from './demoAccounts'

type StoredUser = UserView & {
  password: string
  state?: string
  artStyle?: string
  artistBio?: string
  portfolio: string[]
  createdAt: string
  reviewNote?: string
}
type StoredArtwork = ArtworkView & { ownerId?: string }
type StoredOrder = OrderView & { ownerId: string }
type Db = { users: StoredUser[]; artworks: StoredArtwork[]; orders?: StoredOrder[] }

const DB_KEY = 'namba-db-v2'
const SESSION_KEY = 'namba-session-v1'
const DEMO_PASSWORD = 'Galerie123!'

function seedDb(): Db {
  const now = new Date().toISOString()
  const demo = (id: string, name: string, email: string, password: string, role: UserView['role'], artistStatus: UserView['artistStatus'], city: string): StoredUser =>
    ({ id, name, email, role, artistStatus, city, password, portfolio: [], createdAt: now })
  return {
    users: [
      demo('u-buyer', 'Camila Prado', DEMO_ACCOUNTS.buyer.email, DEMO_ACCOUNTS.buyer.password, 'buyer', 'not-applicable', 'São Paulo'),
      demo('u-artist', 'Mariana Luz', DEMO_ACCOUNTS.artist.email, DEMO_ACCOUNTS.artist.password, 'artist', 'approved', 'Goiânia'),
      demo('u-admin', 'Curadoria Nambá', DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password, 'admin', 'not-applicable', 'São Paulo'),
      ...seedCandidates.map((c): StoredUser => ({
        id: c.id, name: c.name, email: c.email, role: 'artist', artistStatus: 'pending', city: c.city, state: c.state,
        artStyle: c.artStyle, artistBio: c.artistBio, portfolio: c.portfolio, createdAt: c.createdAt, password: DEMO_PASSWORD,
      })),
    ],
    artworks: seedArtworks.map((art) => ({ ...art })),
  }
}

function readDb(): Db {
  try {
    const raw = window.localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch { /* storage indisponível: recomeça do zero */ }
  const db = seedDb()
  writeDb(db)
  return db
}

function writeDb(db: Db) {
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    throw new Error('Armazenamento local cheio')
  }
}

const getSession = () => window.localStorage.getItem(SESSION_KEY)
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const publicUser = ({ id, name, email, role, artistStatus, city, address }: StoredUser): UserView => ({ id, name, email, role, artistStatus, city, address })

// Reduz as imagens enviadas para caberem no localStorage.
function fileToDataUrl(file: File, maxSize = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Imagem inválida'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

const filesOf = (data: FormData, key: string) =>
  data.getAll(key).filter((entry): entry is File => entry instanceof File && entry.size > 0).slice(0, 5)

// ---------- leitura ----------
export async function currentUser(): Promise<UserView | null> {
  const id = getSession()
  const user = readDb().users.find((u) => u.id === id)
  return user ? publicUser(user) : null
}

export async function listArtworks(): Promise<ArtworkView[]> {
  const me = await currentUser()
  const db = readDb()
  expireOrders(db)
  return db.artworks
    .filter((art) => art.status === 'published' || me?.role === 'admin' || art.ownerId === me?.id)
    .map(({ ownerId: _ownerId, ...art }) => art)
    .reverse()
}

export async function listCandidates(): Promise<ArtistCandidate[]> {
  const me = await currentUser()
  if (me?.role !== 'admin') return []
  return readDb().users
    .filter((u) => u.role === 'artist' && u.artistStatus === 'pending')
    .map((u) => ({
      id: u.id, name: u.name, email: u.email, city: u.city || 'Localização não informada', state: u.state ?? '',
      artStyle: u.artStyle ?? 'Estilo não informado', artistBio: u.artistBio ?? '', createdAt: u.createdAt, portfolio: u.portfolio,
    }))
}

// ---------- ações ----------
export async function loginAction(data: FormData): Promise<ActionResult> {
  const email = text(data, 'email').toLowerCase()
  const user = readDb().users.find((u) => u.email.toLowerCase() === email && u.password === text(data, 'password'))
  if (!user) return { ok: false, message: 'E-mail ou senha inválidos.' }
  window.localStorage.setItem(SESSION_KEY, user.id)
  return { ok: true, message: 'Bem-vindo à Nambá Galerie.' }
}

export async function demoLoginAction(role: 'buyer' | 'artist' | 'admin'): Promise<ActionResult> {
  const { email, password } = DEMO_ACCOUNTS[role]
  const data = new FormData()
  data.set('email', email)
  data.set('password', password)
  const result = await loginAction(data)
  return result.ok ? { ok: true, message: 'Modo de demonstração iniciado.' } : { ok: false, message: 'As contas de demonstração ainda não foram preparadas.' }
}

export async function logoutAction(): Promise<ActionResult> {
  window.localStorage.removeItem(SESSION_KEY)
  return { ok: true, message: 'Sessão encerrada.' }
}

export async function registerAction(data: FormData): Promise<ActionResult> {
  const role = text(data, 'role')
  if (role !== 'buyer' && role !== 'artist') return { ok: false, message: 'Escolha um perfil válido.', field: 'role' }
  const name = text(data, 'name')
  const email = text(data, 'email').toLowerCase()
  const password = text(data, 'password')
  if (name.length < 3) return { ok: false, message: 'Informe seu nome completo.', field: 'name' }
  if (!email.includes('@')) return { ok: false, message: 'Informe um e-mail válido.', field: 'email' }
  if (password.length < 8) return { ok: false, message: 'A senha deve ter ao menos 8 caracteres.', field: 'password' }
  if (text(data, 'cpf').replace(/\D/g, '').length !== 11) return { ok: false, message: 'Informe um CPF válido.', field: 'cpf' }

  const db = readDb()
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, message: 'Não foi possível criar a conta. Verifique se o e-mail já está em uso.' }
  }
  try {
    const user: StoredUser = {
      id: `u-${Date.now()}`, name, email, password, role, city: text(data, 'city'), state: text(data, 'state'),
      address: {
        cep: text(data, 'cep'), street: text(data, 'street'), number: text(data, 'number'), complement: text(data, 'complement'),
        neighborhood: text(data, 'neighborhood'), city: text(data, 'city'), state: text(data, 'state').toUpperCase(),
      },
      artistStatus: role === 'artist' ? 'pending' : 'not-applicable',
      artStyle: role === 'artist' ? text(data, 'artStyle') : undefined,
      artistBio: role === 'artist' ? text(data, 'artistBio') : undefined,
      portfolio: role === 'artist' ? await Promise.all(filesOf(data, 'portfolio').map((f) => fileToDataUrl(f))) : [],
      createdAt: new Date().toISOString(),
    }
    db.users.push(user)
    writeDb(db)
    window.localStorage.setItem(SESSION_KEY, user.id)
  } catch {
    return { ok: false, message: 'Não foi possível criar a conta. Tente novamente.' }
  }
  return {
    ok: true,
    message: role === 'artist' ? 'Cadastro enviado. Seu portfólio será analisado em até 48h.' : 'Conta criada. Bem-vindo à Nambá Galerie.',
  }
}

export async function createArtworkAction(data: FormData): Promise<ActionResult> {
  const me = await currentUser()
  if (!me || me.role !== 'artist' || me.artistStatus !== 'approved') return { ok: false, message: 'Apenas artistas aprovados podem publicar obras.' }
  const files = filesOf(data, 'images')
  if (!files.length) return { ok: false, message: 'Adicione ao menos uma imagem da obra.', field: 'images' }
  try {
    const db = readDb()
    db.artworks.push({
      id: `a-${Date.now()}`, ownerId: me.id, artistName: me.name,
      title: text(data, 'title'), technique: text(data, 'technique'), description: text(data, 'description'),
      width: Number(text(data, 'width')) || undefined, height: Number(text(data, 'height')) || undefined,
      year: Number(text(data, 'year')) || new Date().getFullYear(),
      price: Number(text(data, 'price').replace(',', '.')),
      image: await fileToDataUrl(files[0]),
      status: text(data, 'submitType') === 'draft' ? 'draft' : 'published',
    })
    writeDb(db)
    return { ok: true, message: 'Obra publicada com sucesso.' }
  } catch {
    return { ok: false, message: 'Não foi possível publicar. Revise os campos e tente novamente.' }
  }
}

export async function reviewArtistAction(artistId: string, decision: 'approved' | 'rejected', note: string): Promise<ActionResult> {
  const me = await currentUser()
  if (me?.role !== 'admin') return { ok: false, message: 'Acesso restrito à administração.' }
  const db = readDb()
  const artist = db.users.find((u) => u.id === artistId)
  if (artist) {
    artist.artistStatus = decision
    artist.reviewNote = note
    writeDb(db)
  }
  return { ok: true, message: decision === 'approved' ? 'Artista aprovado para vender.' : 'Cadastro devolvido com observações.' }
}

// ---------- pedidos (simulados) ----------
const ORDER_HOURS = 24

// Pedidos vencidos devolvem a obra para a vitrine (no back-end real isto é feito pelo servidor).
function expireOrders(db: Db) {
  let changed = false
  for (const order of db.orders ?? []) {
    if (order.status === 'pending' && order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
      closeOrder(db, order)
      changed = true
    }
  }
  if (changed) writeDb(db)
}

function closeOrder(db: Db, order: StoredOrder) {
  order.status = 'cancelled'
  order.canCancel = false
  order.canSimulatePayment = false
  order.expiresAt = null
  for (const item of order.items) {
    const art = db.artworks.find((a) => a.id === item.artworkId)
    if (art?.status === 'reserved') art.status = 'published'
  }
}

const publicOrder = ({ ownerId: _ownerId, ...order }: StoredOrder): OrderView => order

export async function listOrders(): Promise<OrderView[]> {
  const me = await currentUser()
  if (!me) return []
  const db = readDb()
  expireOrders(db)
  return (db.orders ?? []).filter((o) => o.ownerId === me.id).map(publicOrder).reverse()
}

export async function createOrderAction(input: OrderInput): Promise<ActionResult> {
  const me = await currentUser()
  if (!me) return { ok: false, message: 'Faça login para continuar.' }
  const db = readDb()
  expireOrders(db)
  const ids = [...new Set(input.items)]
  const arts = ids.map((id) => db.artworks.find((a) => a.id === id))
  const gone = ids.filter((_, i) => !arts[i] || arts[i]!.status !== 'published')
  if (gone.length) return { ok: false, message: 'Uma ou mais obras do carrinho acabaram de ser vendidas ou reservadas.', field: 'items', unavailable: gone }
  if (arts.some((a) => a!.ownerId === me.id)) return { ok: false, message: 'Você não pode comprar a sua própria obra.', field: 'items' }

  const subtotal = arts.reduce((sum, a) => sum + a!.price, 0)
  const orders = (db.orders ??= [])
  const id = String(orders.length + 1)
  orders.push({
    id, ownerId: me.id, number: `NG-${id.padStart(6, '0')}`, status: 'pending', createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ORDER_HOURS * 3600_000).toISOString(), subtotal, shipping: 0, total: subtotal,
    deliveryType: 'shipping', paymentMethod: input.paymentMethod, paymentStatus: 'pending', address: input.address,
    items: arts.map((a) => ({ artworkId: a!.id, title: a!.title, artistName: a!.artistName, price: a!.price, image: a!.image })),
    canCancel: true, canSimulatePayment: true,
  })
  arts.forEach((a) => { a!.status = 'reserved' })
  writeDb(db)
  return { ok: true, message: 'Pedido registrado. Aguardando pagamento.', order: publicOrder(orders[orders.length - 1]) }
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  const me = await currentUser()
  const db = readDb()
  expireOrders(db)
  const order = db.orders?.find((o) => o.id === orderId && o.ownerId === me?.id)
  if (!order) return { ok: false, message: 'Pedido não encontrado.' }
  if (order.status !== 'pending') return { ok: false, message: 'Este pedido não pode mais ser cancelado.' }
  closeOrder(db, order)
  writeDb(db)
  return { ok: true, message: 'Pedido cancelado. As obras voltaram para a vitrine.', order: publicOrder(order) }
}

export async function simulatePaymentAction(orderId: string): Promise<ActionResult> {
  const me = await currentUser()
  const db = readDb()
  expireOrders(db)
  const order = db.orders?.find((o) => o.id === orderId && o.ownerId === me?.id)
  if (!order) return { ok: false, message: 'Pedido não encontrado.' }
  if (order.status !== 'pending') return { ok: false, message: 'Este pedido não está aguardando pagamento.' }
  order.status = 'paid'
  order.paymentStatus = 'approved'
  order.canCancel = false
  order.canSimulatePayment = false
  order.expiresAt = null
  for (const item of order.items) {
    const art = db.artworks.find((a) => a.id === item.artworkId)
    if (art) art.status = 'sold'
  }
  writeDb(db)
  return { ok: true, message: 'Pagamento simulado com sucesso.', order: publicOrder(order) }
}

// ---------- vendas e relatórios (simulados) ----------
const PAID: OrderStatus[] = ['paid', 'shipped', 'delivered']

export async function listSales(): Promise<SaleView[]> {
  const me = await currentUser()
  if (!me || me.role === 'buyer') throw new Error('Acesso restrito a artistas')
  const db = readDb()
  expireOrders(db)
  const sales: SaleView[] = []
  for (const order of [...(db.orders ?? [])].reverse()) {
    if (order.status === 'cancelled') continue
    const buyer = db.users.find((u) => u.id === order.ownerId)
    for (const item of order.items) {
      const art = db.artworks.find((a) => a.id === item.artworkId)
      if (me.role === 'artist' && art?.ownerId !== me.id && item.artistName !== me.name) continue
      sales.push({
        orderId: order.id, orderNumber: order.number, status: order.status, createdAt: order.createdAt, artworkId: item.artworkId,
        title: item.title, artistName: item.artistName, image: item.image, price: item.price,
        buyerName: buyer?.name ?? 'Comprador', buyerCity: buyer?.city ?? '', buyerState: buyer?.state ?? '',
      })
    }
  }
  return sales
}

export async function listAdminOrders(): Promise<AdminOrderView[]> {
  const me = await currentUser()
  if (me?.role !== 'admin') throw new Error('Acesso restrito')
  const db = readDb()
  expireOrders(db)
  return [...(db.orders ?? [])].reverse().map((order) => {
    const buyer = db.users.find((u) => u.id === order.ownerId)
    return { ...publicOrder(order), buyerName: buyer?.name ?? 'Comprador', buyerEmail: buyer?.email ?? '' }
  })
}

export async function getReports(): Promise<ReportsView> {
  const me = await currentUser()
  if (me?.role !== 'admin') throw new Error('Acesso restrito')
  const db = readDb()
  expireOrders(db)
  const orders = db.orders ?? []
  const paid = orders.filter((o) => PAID.includes(o.status))
  const revenue = paid.reduce((sum, o) => sum + o.subtotal, 0)
  const byArtist = new Map<string, { name: string; sold: number; revenue: number }>()
  const byTechnique = new Map<string, { technique: string; sold: number; revenue: number }>()
  for (const order of paid) {
    for (const item of order.items) {
      const artist = byArtist.get(item.artistName) ?? { name: item.artistName, sold: 0, revenue: 0 }
      artist.sold += 1
      artist.revenue += item.price
      byArtist.set(item.artistName, artist)
      const technique = db.artworks.find((a) => a.id === item.artworkId)?.technique ?? 'Sem técnica'
      const row = byTechnique.get(technique) ?? { technique, sold: 0, revenue: 0 }
      row.sold += 1
      row.revenue += item.price
      byTechnique.set(technique, row)
    }
  }
  const count = (status: OrderStatus) => orders.filter((o) => o.status === status).length
  return {
    revenue, paidOrders: paid.length, averageTicket: paid.length ? revenue / paid.length : 0,
    ordersByStatus: { pending: count('pending'), paid: count('paid'), shipped: count('shipped'), delivered: count('delivered'), cancelled: count('cancelled') },
    catalog: {
      onSale: db.artworks.filter((a) => a.status === 'published').length,
      outOfStock: db.artworks.filter((a) => a.status === 'reserved' || a.status === 'sold').length,
      drafts: db.artworks.filter((a) => a.status === 'draft').length,
    },
    topArtists: [...byArtist.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    salesByTechnique: [...byTechnique.values()].sort((a, b) => b.sold - a.sold),
  }
}
