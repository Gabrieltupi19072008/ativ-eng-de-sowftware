// Modo simulado: tudo no navegador (localStorage), sem back-end.
// Ligado com VITE_USE_MOCK=true. Tem as mesmas funções de api.ts, que escolhe qual usar.
import { seedArtworks, seedCandidates } from './data/seed'
import type { AdminOrderView, Address, PublicArtist, SavedAddress, ArtistCandidate, ArtworkView, OrderStatus, OrderView, ReportsView, SaleView, UserView } from './GalerieApp'

import type { ActionResult, ArtworkInput, OrderInput, ProfileInput } from './api'
import { DEMO_ACCOUNTS } from './demoAccounts'

type StoredUser = UserView & {
  password: string
  state?: string
  artStyle?: string
  artistBio?: string
  portfolio: string[]
  createdAt: string
  reviewNote?: string
  phone?: string
  bio?: string
  birthDate?: string
  addresses?: SavedAddress[]
}
type StoredArtwork = ArtworkView & { ownerId?: string }
type StoredOrder = OrderView & { ownerId: string }
type Db = { users: StoredUser[]; artworks: StoredArtwork[]; orders?: StoredOrder[]; favorites?: Record<string, string[]>; resetTokens?: { token: string; userId: string }[] }

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
    artworks: seedArtworks.map((art) => ({ ...art, ownerId: art.artistId || undefined })),
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
const publicUser = ({ id, name, email, role, artistStatus, city, state, phone, bio, birthDate, address, addresses }: StoredUser): UserView => ({ id, name, email, role, artistStatus, city, state, phone, bio, birthDate, address: addresses ? addresses[0] : address })

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
    .map(({ ownerId, ...art }) => ({ ...art, artistId: ownerId ?? art.artistId }))
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

export async function listApprovedArtists(): Promise<ArtistCandidate[]> {
  const me = await currentUser()
  if (me?.role !== 'admin') return []
  return readDb().users
    .filter((u) => u.role === 'artist' && u.artistStatus === 'approved')
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
      id: `a-${Date.now()}`, ownerId: me.id, artistId: me.id, artistName: me.name,
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
        shipment: order.shipment ?? null, canShip: order.status === 'paid', canDeliver: order.status === 'shipped',
        shippingAddress: PAID.includes(order.status) ? order.address : null,
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
    return { ...publicOrder(order), buyerName: buyer?.name ?? 'Comprador', buyerEmail: buyer?.email ?? '', canShip: order.status === 'paid', canDeliver: order.status === 'shipped' }
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

// ---------- envio e entrega (simulados) ----------
function sellerOrder(db: Db, me: UserView | null, orderId: string): StoredOrder | undefined {
  const order = db.orders?.find((o) => o.id === orderId)
  if (!order || !me) return undefined
  if (me.role === 'admin') return order
  const mine = order.items.every((item) => {
    const art = db.artworks.find((a) => a.id === item.artworkId)
    return me.role === 'artist' && (art?.ownerId === me.id || item.artistName === me.name)
  })
  return mine ? order : undefined
}

export async function shipOrderAction(orderId: string, trackingCode: string): Promise<ActionResult> {
  const db = readDb()
  const order = sellerOrder(db, await currentUser(), orderId)
  if (!order) return { ok: false, message: 'Pedido não encontrado.' }
  const code = trackingCode.trim().toUpperCase()
  if (!/^[A-Z0-9]{5,60}$/.test(code)) return { ok: false, message: 'Informe um código de rastreio válido (5 a 60 letras e números, sem espaços).', field: 'trackingCode' }
  if ((db.orders ?? []).some((o) => o.shipment?.trackingCode === code)) return { ok: false, message: 'Este código de rastreio já foi usado em outro pedido.', field: 'trackingCode' }
  if (order.status !== 'paid') return { ok: false, message: 'Só é possível enviar um pedido que já foi pago e ainda não foi enviado.' }
  order.status = 'shipped'
  order.shipment = { trackingCode: code, carrier: 'Correios', shippedAt: new Date().toISOString().slice(0, 10), deliveredAt: null }
  writeDb(db)
  return { ok: true, message: 'Pedido marcado como enviado.', order: publicOrder(order) }
}

export async function deliverOrderAction(orderId: string): Promise<ActionResult> {
  const db = readDb()
  const order = sellerOrder(db, await currentUser(), orderId)
  if (!order) return { ok: false, message: 'Pedido não encontrado.' }
  if (order.status !== 'shipped' || !order.shipment) return { ok: false, message: 'Só é possível marcar como entregue um pedido que já foi enviado.' }
  order.status = 'delivered'
  order.shipment.deliveredAt = new Date().toISOString().slice(0, 10)
  writeDb(db)
  return { ok: true, message: 'Pedido marcado como entregue.', order: publicOrder(order) }
}

// ---------- editar, excluir e despublicar obras (simulado) ----------
function ownArtwork(db: Db, me: UserView | null, id: string): { art?: StoredArtwork; error?: ActionResult } {
  const art = db.artworks.find((a) => a.id === id)
  if (!me || me.role !== 'artist' || !art || (art.ownerId !== me.id && art.artistName !== me.name)) return { error: { ok: false, message: 'Obra não encontrada.' } }
  if (art.status === 'reserved' || art.status === 'sold') return { error: { ok: false, message: 'Esta obra está reservada ou já foi vendida e não pode mais ser alterada.' } }
  if (art.status === 'hidden') return { error: { ok: false, message: 'Esta obra foi despublicada pela curadoria. Fale com a administração.' } }
  return { art }
}

export async function updateArtworkAction(id: string, input: ArtworkInput): Promise<ActionResult> {
  const db = readDb()
  const { art, error } = ownArtwork(db, await currentUser(), id)
  if (!art) return error!
  const price = Number(input.price.replace(',', '.'))
  if (input.title.trim().length < 3) return { ok: false, message: 'Dê um título à obra (de 3 a 150 caracteres).', field: 'title' }
  if (!(price > 0)) return { ok: false, message: 'Informe um valor válido.', field: 'price' }
  Object.assign(art, {
    title: input.title.trim(), technique: input.technique, description: input.description.trim(), price,
    width: Number(input.width) || undefined, height: Number(input.height) || undefined, year: Number(input.year) || undefined,
    status: input.submitType === 'draft' ? 'draft' : 'published',
  })
  writeDb(db)
  return { ok: true, message: art.status === 'published' ? 'Obra atualizada.' : 'Obra salva como rascunho.' }
}

export async function deleteArtworkAction(id: string): Promise<ActionResult> {
  const db = readDb()
  const { art, error } = ownArtwork(db, await currentUser(), id)
  if (!art) return error!
  if ((db.orders ?? []).some((o) => o.items.some((item) => item.artworkId === id))) {
    return { ok: false, message: 'Esta obra já apareceu em um pedido e não pode ser excluída. Salve-a como rascunho para tirá-la da vitrine.' }
  }
  db.artworks = db.artworks.filter((a) => a.id !== id)
  writeDb(db)
  return { ok: true, message: 'Obra excluída.' }
}

export async function setArtworkVisibilityAction(id: string, visible: boolean): Promise<ActionResult> {
  const me = await currentUser()
  const db = readDb()
  const art = db.artworks.find((a) => a.id === id)
  if (me?.role !== 'admin' || !art) return { ok: false, message: 'Obra não encontrada.' }
  if (visible && art.status === 'hidden') art.status = 'published'
  else if (!visible && art.status === 'published') art.status = 'hidden'
  writeDb(db)
  return { ok: true, message: visible ? 'Obra devolvida à vitrine.' : 'Obra despublicada.' }
}

// ---------- conta (simulado) ----------
export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const me = await currentUser()
  const db = readDb()
  const user = db.users.find((u) => u.id === me?.id)
  if (!user) return { ok: false, message: 'Faça login para continuar.' }
  if (input.name.trim().length < 3) return { ok: false, message: 'Informe seu nome completo.', field: 'name' }
  const phone = input.phone.replace(/\D/g, '')
  if (phone && (phone.length < 10 || phone.length > 11)) return { ok: false, message: 'Informe o celular com DDD (ex.: (11) 99999-9999).', field: 'phone' }
  if (user.role === 'artist' && input.bio.trim().length < 60) return { ok: false, message: 'Conte sobre sua pesquisa artística (de 60 a 2000 caracteres).', field: 'bio' }
  Object.assign(user, { name: input.name.trim(), phone, city: input.city.trim(), state: input.state.trim().toUpperCase(), birthDate: input.birthDate })
  if (user.role === 'artist') user.bio = input.bio.trim()
  writeDb(db)
  return { ok: true, message: 'Dados atualizados.' }
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  const me = await currentUser()
  const db = readDb()
  const user = db.users.find((u) => u.id === me?.id)
  if (!user) return { ok: false, message: 'Faça login para continuar.' }
  if (user.password !== current) return { ok: false, message: 'A senha atual está incorreta.', field: 'currentPassword' }
  if (next.length < 8) return { ok: false, message: 'A nova senha deve ter entre 8 e 128 caracteres.', field: 'newPassword' }
  if (next === current) return { ok: false, message: 'A nova senha precisa ser diferente da atual.', field: 'newPassword' }
  user.password = next
  writeDb(db)
  return { ok: true, message: 'Senha alterada.' }
}

function addressBook(db: Db, userId: string | undefined): { user?: StoredUser; list: SavedAddress[] } {
  const user = db.users.find((u) => u.id === userId)
  if (user && !user.addresses) user.addresses = user.address ? [{ ...user.address, id: 'addr-0' }] : []
  return { user, list: user?.addresses ?? [] }
}

export async function listAddresses(): Promise<SavedAddress[]> {
  const me = await currentUser()
  return addressBook(readDb(), me?.id).list
}

export async function saveAddressAction(address: Address, id?: string): Promise<ActionResult> {
  const me = await currentUser()
  const db = readDb()
  const { user, list } = addressBook(db, me?.id)
  if (!user) return { ok: false, message: 'Faça login para continuar.' }
  if (address.cep.replace(/\D/g, '').length !== 8) return { ok: false, message: 'Informe um CEP válido.', field: 'cep' }
  if (!address.street.trim() || !address.number.trim() || !address.neighborhood.trim() || !address.city.trim()) return { ok: false, message: 'Preencha rua, número, bairro e cidade.' }
  if (id) {
    const current = list.find((a) => a.id === id)
    if (!current) return { ok: false, message: 'Endereço não encontrado.' }
    Object.assign(current, address)
  } else {
    if (list.length >= 10) return { ok: false, message: 'Você pode ter até 10 endereços. Exclua algum para adicionar outro.' }
    list.push({ ...address, id: `addr-${Date.now()}` })
  }
  writeDb(db)
  return { ok: true, message: id ? 'Endereço atualizado.' : 'Endereço adicionado.' }
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  const me = await currentUser()
  const db = readDb()
  const { user } = addressBook(db, me?.id)
  if (!user?.addresses?.some((a) => a.id === id)) return { ok: false, message: 'Endereço não encontrado.' }
  user.addresses = user.addresses.filter((a) => a.id !== id)
  writeDb(db)
  return { ok: true, message: 'Endereço excluído.' }
}

// ---------- recuperar senha, favoritos e artistas (simulado) ----------
export async function forgotPasswordAction(email: string): Promise<ActionResult> {
  const db = readDb()
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  let hint = ''
  if (user) {
    const token = `demo-${Date.now()}`
    db.resetTokens = [...(db.resetTokens ?? []).filter((t) => t.userId !== user.id), { token, userId: user.id }]
    writeDb(db)
    hint = ` (modo simulado: nenhum e-mail é enviado; use o link ${window.location.origin}/?reset=${token})`
  }
  return { ok: true, message: `Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.${hint}` }
}

export async function resetPasswordAction(token: string, newPassword: string): Promise<ActionResult> {
  const db = readDb()
  if (newPassword.length < 8) return { ok: false, message: 'A nova senha deve ter entre 8 e 128 caracteres.', field: 'newPassword' }
  const entry = db.resetTokens?.find((t) => t.token === token)
  const user = db.users.find((u) => u.id === entry?.userId)
  if (!entry || !user) return { ok: false, message: 'Este link é inválido ou já expirou. Peça um novo em "Esqueci minha senha".', field: 'token' }
  user.password = newPassword
  db.resetTokens = db.resetTokens!.filter((t) => t.userId !== user.id)
  writeDb(db)
  return { ok: true, message: 'Senha redefinida. Entre com a nova senha.' }
}

export async function listFavorites(): Promise<string[]> {
  const me = await currentUser()
  return me ? readDb().favorites?.[me.id] ?? [] : []
}

export async function setFavoriteAction(id: string, on: boolean): Promise<ActionResult> {
  const me = await currentUser()
  if (!me) return { ok: false, message: 'Faça login para continuar.' }
  const db = readDb()
  const favorites = (db.favorites ??= {})
  const current = (favorites[me.id] ??= [])
  favorites[me.id] = on ? [...new Set([...current, id])] : current.filter((item) => item !== id)
  writeDb(db)
  return { ok: true, message: on ? 'Obra favoritada.' : 'Obra removida dos favoritos.' }
}

export async function listPublicArtists(): Promise<PublicArtist[]> {
  const db = readDb()
  const byArtist = new Map<string, StoredArtwork[]>()
  for (const art of db.artworks.filter((a) => a.status === 'published')) byArtist.set(art.artistId, [...(byArtist.get(art.artistId) ?? []), art])
  return [...byArtist.entries()].map(([artistId, works]) => {
    const user = db.users.find((u) => u.id === artistId)
    return { id: artistId, name: works[0].artistName, city: user?.city ?? '', state: user?.state ?? '', artStyle: user?.artStyle ?? works[0].technique, bio: user?.bio ?? '', works: works.length, cover: works[0].image }
  }).sort((a, b) => b.works - a.works || a.name.localeCompare(b.name))
}
