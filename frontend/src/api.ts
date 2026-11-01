// Camada de dados do front-end.
//
// Por enquanto tudo é simulado no navegador (localStorage) para o React funcionar
// sozinho. Quando o back-end em Python estiver pronto, basta trocar o corpo de cada
// função por uma chamada fetch(`${API_URL}/...`) mantendo as mesmas assinaturas —
// o resto do app não precisa mudar.
import { seedArtworks, seedCandidates } from './data/seed'
import type { ArtistCandidate, ArtworkView, UserView } from './GalerieApp'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type ActionResult = { ok: boolean; message: string; field?: string }

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
type Db = { users: StoredUser[]; artworks: StoredArtwork[] }

const DB_KEY = 'namba-db-v2'
const SESSION_KEY = 'namba-session-v1'
const DEMO_PASSWORD = 'Galerie123!'

function seedDb(): Db {
  const now = new Date().toISOString()
  const demo = (id: string, name: string, email: string, password: string, role: UserView['role'], artistStatus: UserView['artistStatus'], city: string): StoredUser =>
    ({ id, name, email, role, artistStatus, city, password, portfolio: [], createdAt: now })
  return {
    users: [
      // Contas de teste locais (somente simuladas no navegador). Trocar quando o back-end real existir.
      demo('u-buyer', 'Camila Prado', 'comprador@nambagalerie.com', 'comprador@123', 'buyer', 'not-applicable', 'São Paulo'),
      demo('u-artist', 'Mariana Luz', 'comerciante@nambagalerie.com', 'comerciante@123', 'artist', 'approved', 'Goiânia'),
      demo('u-admin', 'Curadoria Nambá', 'admin@nambagalerie.com', 'nambagalerie@', 'admin', 'not-applicable', 'São Paulo'),
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
const publicUser = ({ id, name, email, role, artistStatus, city }: StoredUser): UserView => ({ id, name, email, role, artistStatus, city })

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
  return readDb().artworks
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
