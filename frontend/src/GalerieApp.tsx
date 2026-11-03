import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { forgotPasswordAction, listFavorites, listPublicArtists, resetPasswordAction, setFavoriteAction, changePasswordAction, deleteAddressAction, listAddresses, saveAddressAction, updateProfileAction, cancelOrderAction, createArtworkAction, deleteArtworkAction, setArtworkVisibilityAction, updateArtworkAction, deliverOrderAction, shipOrderAction, getReports, listAdminOrders, listSales, createOrderAction, demoLoginAction, listOrders, loginAction, logoutAction, registerAction, reviewArtistAction, simulatePaymentAction, lookupCep, type ActionResult, type CepAddress } from './api'

export type Address = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export const emptyAddress: Address = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }

export type UserView = {
  id: string
  name: string
  email: string
  role: 'buyer' | 'artist' | 'admin'
  artistStatus?: 'not-applicable' | 'pending' | 'approved' | 'rejected' | null
  city: string
  state?: string
  phone?: string
  bio?: string
  birthDate?: string
  address?: Address
}

export type PublicArtist = { id: string; name: string; city: string; state: string; artStyle: string; bio: string; works: number; cover: string }

export type SavedAddress = Address & { id: string }

export type ArtworkView = {
  id: string
  title: string
  artistId: string
  artistName: string
  technique: string
  description: string
  price: number
  year?: number
  width?: number
  height?: number
  image: string
  status: string
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentMethod = 'pix' | 'boleto' | 'credit'

export type Shipment = { trackingCode: string; carrier: string; shippedAt: string | null; deliveredAt: string | null }

export type OrderView = {
  id: string
  number: string
  status: OrderStatus
  createdAt: string
  expiresAt: string | null
  subtotal: number
  shipping: number
  total: number
  deliveryType: 'shipping' | 'pickup'
  paymentMethod: PaymentMethod | null
  paymentStatus: string | null
  items: { artworkId: string; title: string; artistName: string; price: number; image: string }[]
  address: Address
  shipment?: Shipment | null
  canCancel: boolean
  canSimulatePayment: boolean
}

export type SaleView = {
  orderId: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  artworkId: string
  title: string
  artistName: string
  image: string
  price: number
  buyerName: string
  buyerCity: string
  buyerState: string
  shipment: Shipment | null
  canShip: boolean
  canDeliver: boolean
  shippingAddress: Address | null
}

export type AdminOrderView = OrderView & { buyerName: string; buyerEmail: string; canShip: boolean; canDeliver: boolean }

export type ReportsView = {
  revenue: number
  paidOrders: number
  averageTicket: number
  ordersByStatus: Record<OrderStatus, number>
  catalog: { onSale: number; outOfStock: number; drafts: number }
  topArtists: { name: string; sold: number; revenue: number }[]
  salesByTechnique: { technique: string; sold: number; revenue: number }[]
}

export type ArtistCandidate = {
  id: string
  name: string
  email: string
  city: string
  state: string
  artStyle: string
  artistBio: string
  createdAt: string
  portfolio: string[]
}

type View = 'login' | 'register' | 'forgot' | 'reset' | 'shop' | 'artists' | 'collections' | 'add-art' | 'account' | 'admin'
type RegisterRole = 'buyer' | 'artist'

const filters = ['Todos', 'Óleo', 'Aquarela', 'Acrílica', 'Pastel', 'Arte Digital', 'Técnica Mista']

type ImageProps = { src: string; alt: string; fill?: boolean; priority?: boolean; sizes?: string }
function Image({ src, alt, fill, priority, sizes }: ImageProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (failed) return <span className={`img-fallback${fill ? ' fill-img' : ''}`} role="img" aria-label={alt || 'Imagem indisponível'}><Icon name="art" size={28} /></span>
  return <img src={src} alt={alt} sizes={sizes} className={fill ? 'fill-img' : undefined} loading={priority ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
}

function Icon({ name, size = 20 }: { name: 'arrow' | 'bag' | 'heart' | 'user' | 'upload' | 'check' | 'close' | 'plus' | 'logout' | 'art' | 'sun' | 'moon' | 'pix' | 'card' | 'barcode'; size?: number }) {
  if (name === 'pix') {
    return <svg aria-hidden="true" width={size} height={size} viewBox="535.59 20.81 75.03 84.26" fill="currentColor">
      <path d="m596.827 86.62c-3.08 0-5.978-1.199-8.156-3.377l-11.777-11.777c-.827-.829-2.268-.827-3.094 0l-11.82 11.82c-2.178 2.178-5.076 3.377-8.156 3.377h-2.321l14.916 14.916c4.658 4.658 12.21 4.658 16.869 0l14.958-14.959Z" />
      <path d="M553.824 44.963c3.08 0 5.978 1.2 8.156 3.377l11.82 11.822c.85.851 2.24.855 3.094-.001l11.777-11.778c2.178-2.177 5.075-3.377 8.156-3.377h1.419l-14.958-14.959c-4.659-4.658-12.211-4.658-16.87 0l-14.915 14.915Z" />
      <path d="m610.618 57.379-9.039-9.04a1.75 1.75 0 0 1-.642.13h-4.11a8.07 8.07 0 0 0-5.706 2.364l-11.776 11.777a5.64 5.64 0 0 1-3.997 1.654 5.64 5.64 0 0 1-3.997-1.653L559.53 50.79a8.07 8.07 0 0 0-5.706-2.364h-5.054c-.216 0-.417-.05-.607-.122l-9.075 9.075c-4.659 4.658-4.659 12.21 0 16.869l9.075 9.075c.19-.072.392-.123.607-.123h5.054a8.07 8.07 0 0 0 5.706-2.364l11.82-11.82c2.136-2.134 5.86-2.135 7.995.001l11.776 11.776a8.07 8.07 0 0 0 5.706 2.364h4.11c.227 0 .443.05.642.13l9.039-9.04c4.658-4.658 4.658-12.21 0-16.868Z" />
    </svg>
  }
  if (name === 'barcode') {
    return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 4h1v16H3zm2 0h2v16H5zm3 0h1v16H8zm2.25 0h.75v16h-.75zm2 0h2v16h-2zm3 0H16v16h-.75zm2 0h1.5v16h-1.5zm2.75 0h1v16h-1z" />
    </svg>
  }
  const paths: Record<typeof name, ReactNode> = {
    arrow: <path d="m9 18 6-6-6-6" />,
    bag: <><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></>,
    art: <><path d="M4 20 14 4l6 16H4Z" /><path d="m8 14 3 2 3-3 3 3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 15h4" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function Logo({ light = false }: { light?: boolean }) {
  return <button type="button" className={`logo ${light ? 'logo-light' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>NAMBÁ GALERIE<span>.</span></button>
}

function Button({ children, type = 'button', kind = 'dark', onClick, disabled, className = '' }: { children: ReactNode; type?: 'button' | 'submit'; kind?: 'dark' | 'gold' | 'outline' | 'ghost' | 'danger'; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${kind} ${className}`}>{children}</button>
}

function Field({ label, name, type = 'text', placeholder, required, defaultValue, step, min }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean; defaultValue?: string; step?: string; min?: string }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue} step={step} min={min} /></label>
}

function Toast({ message, error = false, onClose }: { message: string; error?: boolean; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 4500)
    return () => window.clearTimeout(id)
  }, [onClose])
  return <div className={`toast ${error ? 'toast-error' : ''}`}><Icon name={error ? 'close' : 'check'} size={17} /><span>{message}</span></div>
}

export default function GalerieApp({ initialUser, initialArtworks, initialCandidates, onRefresh }: { initialUser: UserView | null; initialArtworks: ArtworkView[]; initialCandidates: ArtistCandidate[]; onRefresh: () => void }) {
  const resetToken = useMemo(() => new URLSearchParams(window.location.search).get('reset') ?? '', [])
  const [view, setView] = useState<View>(initialUser ? (initialUser.role === 'admin' ? 'admin' : 'shop') : resetToken ? 'reset' : 'login')
  const [artistFilter, setArtistFilter] = useState<{ id: string; name: string } | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [registerRole, setRegisterRole] = useState<RegisterRole>('buyer')
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [favorites, setFavorites] = useState<string[]>([])
  const [cart, setCart] = useState<ArtworkView[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPreview, setCheckoutPreview] = useState(false)
  const [selectedArt, setSelectedArt] = useState<ArtworkView | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [accountTab, setAccountTab] = useState<'personal' | 'orders'>('personal')

  const artworks = initialArtworks
  const filtered = useMemo(() => artworks.filter((art) => art.status === 'published'
    && (activeFilter === 'Todos' || (activeFilter === 'Favoritos' ? favorites.includes(art.id) : art.technique === activeFilter))
    && (!artistFilter || art.artistId === artistFilter.id)), [artworks, activeFilter, favorites, artistFilter])

  // Favoritos ficam no banco: carrega ao entrar e grava a cada clique (o coração muda na hora e volta atrás se a gravação falhar)
  useEffect(() => {
    if (initialUser) void listFavorites().then(setFavorites).catch(() => undefined)
  }, [initialUser])

  function toggleFavorite(id: string) {
    const turnOn = !favorites.includes(id)
    setFavorites((items) => turnOn ? [...items, id] : items.filter((item) => item !== id))
    void setFavoriteAction(id, turnOn).then((result) => {
      if (result.ok) return
      setFavorites((items) => turnOn ? items.filter((item) => item !== id) : [...items, id])
      setMessage({ text: result.message, error: true })
    })
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('galerie-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('galerie-theme', theme)
  }, [theme])

  useEffect(() => {
    setCheckoutPreview(new URLSearchParams(window.location.search).get('checkout') === '1')
  }, [])

  function navigate(next: View) {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>, success?: () => void) {
    startTransition(async () => {
      const result = await action()
      setMessage({ text: result.message, error: !result.ok })
      if (result.ok) {
        success?.()
        onRefresh()
      }
    })
  }

  function enterAccount(data: FormData) {
    startTransition(async () => {
      const result = await loginAction(data)
      if (!result.ok) {
        setMessage({ text: result.message, error: true })
        return
      }
      window.location.reload()
    })
  }

  function enterDemoAccount(role: 'buyer' | 'artist' | 'admin') {
    startTransition(async () => {
      const result = await demoLoginAction(role)
      if (!result.ok) {
        setMessage({ text: result.message, error: true })
        return
      }
      window.location.reload()
    })
  }

  // Grava o pedido no servidor. Se alguma obra acabou de ser vendida, ela sai do carrinho e a vitrine é recarregada.
  async function placeOrder(input: { address: Address; paymentMethod: PaymentMethod }): Promise<ActionResult> {
    const result = await createOrderAction({ items: cart.map((item) => item.id), ...input })
    if (result.ok) {
      onRefresh()
    } else if (result.unavailable?.length) {
      const remaining = cart.filter((item) => !result.unavailable!.includes(item.id))
      setCart(remaining)
      onRefresh()
      if (!remaining.length) {
        setCheckoutOpen(false)
        setMessage({ text: result.message, error: true })
      } else {
        return { ...result, message: `${result.message} Ela foi removida do seu carrinho.` }
      }
    }
    return result
  }

  function exitAccount() {
    startTransition(async () => {
      await logoutAction()
      window.location.reload()
    })
  }

  if (checkoutPreview) {
    return <div className={`preview-theme theme-${theme}`}><Checkout defaultAddress={initialUser?.address} items={artworks.slice(0, 1)} placeOrder={async () => ({ ok: true, message: 'Prévia' })} close={() => { setCheckoutPreview(false); window.history.replaceState({}, '', window.location.pathname) }} finish={() => { setCheckoutPreview(false); window.history.replaceState({}, '', window.location.pathname) }} /></div>
  }

  if (!initialUser && view === 'login') {
    return <Login
      submit={enterAccount}
      quickAccess={enterDemoAccount}
      pending={isPending}
      error={message?.error ? message.text : null}
      createAccount={() => {
        setRegisterRole('buyer')
        navigate('register')
      }}
      forgot={() => navigate('forgot')}
    />
  }

  if (!initialUser && view === 'forgot') {
    return <ForgotPassword back={() => navigate('login')} />
  }

  if (!initialUser && view === 'reset') {
    return <ResetPassword token={resetToken} done={() => { window.history.replaceState({}, '', window.location.pathname); navigate('login') }} />
  }

  if (!initialUser && view === 'register') {
    return <>
      <Register role={registerRole} setRole={setRegisterRole} back={() => navigate('login')} pending={isPending} submit={(data) => run(() => registerAction(data), () => navigate(registerRole === 'artist' ? 'account' : 'shop'))} />
      {message && <Toast message={message.text} error={message.error} onClose={() => setMessage(null)} />}
    </>
  }

  const user = initialUser
  if (!user) {
    return <Login submit={enterAccount} quickAccess={enterDemoAccount} pending={isPending} error={message?.error ? message.text : null} createAccount={() => navigate('register')} forgot={() => navigate('forgot')} />
  }

  return <div className={`preview-theme theme-${theme}`}>
    {view === 'admin' ? (
      <Admin candidates={initialCandidates} artworks={artworks} user={user} theme={theme} toggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} back={() => navigate('shop')} review={(id, decision, note) => run(() => reviewArtistAction(id, decision, note))} reload={onRefresh} pending={isPending} logout={exitAccount} />
    ) : (
      <div className="app-shell">
        <Header user={user} theme={theme} toggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} cartCount={cart.length} onCart={() => setCartOpen(true)} onAccount={() => navigate('account')} onShop={() => { setActiveFilter('Todos'); setArtistFilter(null); navigate('shop') }} onArtists={() => navigate('artists')} onCollections={() => navigate('collections')} onAdd={() => navigate('add-art')} onAdmin={() => navigate('admin')} logout={exitAccount} />
        {view === 'shop' && <Shop user={user} artworks={filtered} total={artworks.length} filter={activeFilter} setFilter={setActiveFilter} favorite={favorites} toggleFavorite={toggleFavorite} artistFilter={artistFilter} clearArtist={() => setArtistFilter(null)} addCart={(art) => { setCart((items) => items.some((item) => item.id === art.id) ? items : [...items, art]); setMessage({ text: `${art.title} foi adicionada ao carrinho.` }) }} select={setSelectedArt} onAdd={() => navigate('add-art')} />}
        {view === 'artists' && <ArtistsPage openArtist={(artist) => { setArtistFilter({ id: artist.id, name: artist.name }); setActiveFilter('Todos'); navigate('shop') }} />}
        {view === 'collections' && <CollectionsPage artworks={artworks} openCollection={(technique) => { setArtistFilter(null); setActiveFilter(technique); navigate('shop') }} />}
        {view === 'add-art' && <AddArtwork back={() => navigate('shop')} pending={isPending} submit={(data) => run(() => createArtworkAction(data), () => navigate('shop'))} />}
        {view === 'account' && <Account user={user} artworks={artworks} initialTab={accountTab} back={() => { setAccountTab('personal'); navigate('shop') }} onOrdersChange={onRefresh} />}
      </div>
    )}
    {cartOpen && <Cart items={cart} close={() => setCartOpen(false)} remove={(id) => setCart((items) => items.filter((item) => item.id !== id))} checkout={() => { setCartOpen(false); setCheckoutOpen(true) }} />}
    {checkoutOpen && <Checkout defaultAddress={user.address} items={cart} close={() => setCheckoutOpen(false)} placeOrder={placeOrder} finish={() => { setCart([]); setCheckoutOpen(false) }} viewOrders={() => { setCart([]); setCheckoutOpen(false); setAccountTab('orders'); navigate('account') }} />}
    {selectedArt && <ArtModal art={selectedArt} close={() => setSelectedArt(null)} add={() => { setCart((items) => items.some((item) => item.id === selectedArt.id) ? items : [...items, selectedArt]); setSelectedArt(null); setCartOpen(true) }} />}
    {message && <Toast message={message.text} error={message.error} onClose={() => setMessage(null)} />}
  </div>
}

// Mede quanto da capa já foi rolada (0 a 1) e expõe como variável CSS --p.
// O CSS usa --p para animar a capa, o fundo e a entrada do cartão de login.
function useScrollProgress(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const range = Math.max(window.innerHeight * 0.95, 1)
      const p = Math.min(Math.max(window.scrollY / range, 0), 1)
      ref.current?.style.setProperty('--p', p.toFixed(4))
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [ref])
}

const step = (i: number) => ({ '--i': i }) as CSSProperties

function Login({ submit, quickAccess, pending, error, createAccount, forgot }: {
  submit: (data: FormData) => void
  quickAccess: (role: 'buyer' | 'artist' | 'admin') => void
  pending: boolean
  error: string | null
  createAccount: () => void
  forgot: () => void
}) {
  const [notice, setNotice] = useState<string | null>(null)
  const journey = useRef<HTMLElement>(null)
  useScrollProgress(journey)
  return <main className="access-journey" ref={journey}>
    <div className="access-backdrop" aria-hidden="true">
      <Image src="/galerie-entry-art.jpg" alt="" fill priority sizes="100vw" />
    </div>
    <div className="access-veil" aria-hidden="true" />
    <section className="starry-hero">
      <div className="starry-wash" aria-hidden="true"><span /><span /><span /></div>
      <div className="intro-brand"><Logo /><p>Arte original brasileira</p></div>
      <div className="intro-title"><p>Uma galeria para descobrir</p><h1>Arte que<br /><em>move.</em></h1><span>Role para explorar a Nambá Galerie</span></div>
      <button type="button" className="scroll-invitation" onClick={() => document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth' })}>Rolar para acessar <span>↓</span></button>
    </section>
    <div className="journey-transition" aria-hidden="true"><span /><i /><span /></div>
    <section className="auth-section" id="acesso">
      <div className="auth-brand"><Logo /><span>Acesse sua conta</span></div>
      <div className="auth-card">
        <div className="auth-heading reveal" style={step(0)}>
          <p className="eyebrow">Bem-vindo de volta</p>
          <h1>Acesse sua conta</h1>
          <p>Entre para comprar, vender suas obras ou acessar a administração.</p>
        </div>
        <div className="quick-access reveal" style={step(3)}><span>Acesso rápido para visualizar</span><div><button type="button" disabled={pending} onClick={() => quickAccess('buyer')}>Comprador</button><button type="button" disabled={pending} onClick={() => quickAccess('artist')}>Artista / Vendedor</button><button type="button" disabled={pending} onClick={() => quickAccess('admin')}>Administrador</button></div></div>
        <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)) }} className="login-form reveal" style={step(1)}>
          <Field label="E-mail" name="email" type="email" placeholder="seu@email.com" required />
          <Field label="Senha" name="password" type="password" placeholder="Sua senha" required />
          {error && <p className="auth-error">{error}</p>}
          <Button type="submit" kind="gold" disabled={pending} className="full">{pending ? 'Entrando…' : 'Entrar'} <Icon name="arrow" /></Button>
        </form>
        <div className="auth-links reveal" style={step(2)}><button type="button" onClick={createAccount}>Criar conta</button><span /><button type="button" onClick={forgot}>Esqueci minha senha</button></div>
      </div>
    </section>
    {notice && <Toast message={notice} onClose={() => setNotice(null)} />}
  </main>
}

const onlyDigits = (value: string) => value.replace(/\D/g, '')
const formatCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

type CepStatus = 'idle' | 'loading' | 'found' | 'notfound' | 'error'

// Busca o endereço assim que o CEP chega a 8 dígitos. Respostas antigas são ignoradas.
function useCepLookup(onFound: (found: CepAddress) => void) {
  const [status, setStatus] = useState<CepStatus>('idle')
  const latest = useRef(0)
  const onFoundRef = useRef(onFound)
  onFoundRef.current = onFound

  const search = useCallback(async (cep: string) => {
    const id = ++latest.current
    if (onlyDigits(cep).length !== 8) {
      setStatus('idle')
      return
    }
    setStatus('loading')
    try {
      const found = await lookupCep(cep)
      if (id !== latest.current) return
      if (found) {
        onFoundRef.current(found)
        setStatus('found')
      } else {
        setStatus('notfound')
      }
    } catch {
      if (id === latest.current) setStatus('error')
    }
  }, [])

  return { status, search }
}

const cepHints: Record<CepStatus, string> = {
  idle: '',
  loading: 'Buscando endereço…',
  found: 'Endereço encontrado. Falta só o número.',
  notfound: 'CEP não encontrado. Confira ou preencha manualmente.',
  error: 'Não foi possível buscar o CEP agora. Preencha manualmente.',
}

// Campos de endereço compartilhados pelo cadastro e pelo checkout.
function AddressFields({ value, onChange, strict }: { value: Address; onChange: (address: Address) => void; strict: boolean }) {
  const numberRef = useRef<HTMLInputElement>(null)
  const current = useRef(value)
  current.current = value
  const { status, search } = useCepLookup((found) => {
    onChange({ ...current.current, ...found })
    numberRef.current?.focus()
  })
  const set = (field: keyof Address, next: string) => onChange({ ...value, [field]: next })

  return <div className="checkout-form-grid address-grid">
    <label className="field"><span>CEP</span><input name="cep" required={strict} inputMode="numeric" autoComplete="postal-code" maxLength={9} value={value.cep} onChange={(event) => { const cep = formatCep(event.target.value); set('cep', cep); void search(cep) }} placeholder="00000-000" />{status !== 'idle' && <small className={`field-hint ${status === 'found' ? 'is-ok' : status === 'notfound' || status === 'error' ? 'is-error' : ''}`}>{cepHints[status]}</small>}</label>
    <label className="field span-two"><span>Rua ou avenida</span><input name="street" required={strict} autoComplete="address-line1" value={value.street} onChange={(event) => set('street', event.target.value)} placeholder="Nome da rua" /></label>
    <label className="field"><span>Número</span><input ref={numberRef} name="number" required={strict} value={value.number} onChange={(event) => set('number', event.target.value)} placeholder="123" /></label>
    <label className="field"><span>Complemento</span><input name="complement" value={value.complement} onChange={(event) => set('complement', event.target.value)} placeholder="Apartamento, bloco..." /></label>
    <label className="field"><span>Bairro</span><input name="neighborhood" required={strict} value={value.neighborhood} onChange={(event) => set('neighborhood', event.target.value)} placeholder="Seu bairro" /></label>
    <label className="field"><span>Cidade</span><input name="city" required value={value.city} onChange={(event) => set('city', event.target.value)} placeholder="Sua cidade" /></label>
    <label className="field"><span>Estado</span><input name="state" required maxLength={2} value={value.state} onChange={(event) => set('state', event.target.value.toUpperCase())} placeholder="UF" /></label>
  </div>
}

function Register({ role, setRole, back, pending, submit }: { role: RegisterRole; setRole: (role: RegisterRole) => void; back: () => void; pending: boolean; submit: (data: FormData) => void }) {
  const [previews, setPreviews] = useState<string[]>([])
  const [location, setLocation] = useState<Address>(emptyAddress)
  return <main className="register-page"><header><Logo /><button className="back-link" type="button" onClick={back}>← Voltar ao início</button></header><div className="register-wrap">
    <section className="register-copy"><p className="eyebrow">Nova conta</p><h1>{role === 'artist' ? 'Apresente sua arte ao mundo.' : 'Comece sua coleção.'}</h1><p>{role === 'artist' ? 'Envie seus dados e algumas obras. Nossa curadoria analisa seu perfil em até 48 horas.' : 'Preencha seus dados para descobrir obras de artistas independentes.'}</p><div className="role-switch"><button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => setRole('buyer')}>Comprador</button><button type="button" className={role === 'artist' ? 'active' : ''} onClick={() => setRole('artist')}>Artista</button></div></section>
    <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)) }} className="register-form"><input type="hidden" name="role" value={role} /><div className="form-section"><h2>Dados pessoais</h2><div className="form-grid"><Field label="Nome completo" name="name" placeholder="Como devemos chamar você?" required /><Field label="E-mail" name="email" type="email" placeholder="voce@email.com" required /><Field label="Celular" name="phone" placeholder="(11) 99999-9999" /><Field label="CPF" name="cpf" placeholder="000.000.000-00" required /><Field label="Data de nascimento" name="birthDate" type="date" /><Field label="Senha" name="password" type="password" placeholder="Mínimo 8 caracteres" required /></div></div>
      <div className="form-section"><h2>Localização</h2><AddressFields value={location} onChange={setLocation} strict={false} /></div>
      {role === 'artist' && <div className="form-section artist-section"><div><h2>Perfil artístico</h2><p>Essas informações serão exibidas para a curadoria.</p></div><label className="field"><span>Técnica ou estilo principal</span><select name="artStyle" required><option value="">Selecione</option>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Sobre sua pesquisa artística</span><textarea name="artistBio" rows={5} required minLength={60} placeholder="Conte sobre sua trajetória, referências e processo criativo…" /></label><label className="portfolio-upload"><input type="file" name="portfolio" accept="image/*" multiple required onChange={(event) => setPreviews(Array.from(event.target.files ?? []).slice(0, 5).map(URL.createObjectURL))} /><Icon name="upload" /><strong>Anexe de 2 a 5 obras do seu portfólio</strong><span>JPG, PNG ou WEBP · até 10 MB por imagem</span></label>{previews.length > 0 && <div className="preview-strip">{previews.map((src, index) => <div key={src}><Image src={src} alt={`Prévia ${index + 1}`} fill sizes="120px" /></div>)}</div>}<div className="review-note"><span>48h</span><p><strong>Análise de curadoria</strong>Você poderá comprar normalmente enquanto seu perfil de vendedor é analisado.</p></div></div>}
      <label className="terms"><input type="checkbox" required /><span>Li e aceito os Termos de Uso e a Política de Privacidade.</span></label><Button type="submit" kind="gold" disabled={pending} className="full">{pending ? 'Enviando…' : role === 'artist' ? 'Enviar para análise' : 'Criar minha conta'}</Button>
    </form>
  </div></main>
}

function Header({ user, theme, toggleTheme, cartCount, onCart, onAccount, onShop, onArtists, onCollections, onAdd, onAdmin, logout }: { user: UserView; theme: 'light' | 'dark'; toggleTheme: () => void; cartCount: number; onCart: () => void; onAccount: () => void; onShop: () => void; onArtists: () => void; onCollections: () => void; onAdd: () => void; onAdmin: () => void; logout: () => void }) {
  const [menu, setMenu] = useState(false)
  return <header className="site-header"><Logo /><nav><button type="button" onClick={onShop}>Obras</button><button type="button" onClick={onArtists}>Artistas</button><button type="button" onClick={onCollections}>Coleções</button></nav><div className="header-actions">
    {user.role === 'artist' && user.artistStatus === 'approved' && <Button kind="gold" onClick={onAdd}><Icon name="plus" size={16} /> Adicionar arte</Button>}
    {user.role === 'admin' && <Button kind="outline" onClick={onAdmin}>Painel ADM</Button>}
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /><span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span></button>
    <button type="button" className="icon-button" onClick={onCart} aria-label="Abrir carrinho"><Icon name="bag" />{cartCount > 0 && <span>{cartCount}</span>}</button>
    <div className="user-menu"><button type="button" onClick={() => setMenu(!menu)} className="avatar">{user.name.charAt(0)}</button>{menu && <div className="menu-popover"><p><strong>{user.name}</strong><span>{user.role === 'buyer' ? 'Comprador' : user.role === 'artist' ? 'Artista' : 'Administrador'}</span></p><button type="button" onClick={() => { setMenu(false); onAccount() }}><Icon name="user" size={17} /> Minha conta</button><button type="button" onClick={logout}><Icon name="logout" size={17} /> Sair</button></div>}</div>
  </div></header>
}

function Shop({ user, artworks, total, filter, setFilter, favorite, toggleFavorite, artistFilter, clearArtist, addCart, select, onAdd }: { artistFilter: { id: string; name: string } | null; clearArtist: () => void; user: UserView; artworks: ArtworkView[]; total: number; filter: string; setFilter: (filter: string) => void; favorite: string[]; toggleFavorite: (id: string) => void; addCart: (art: ArtworkView) => void; select: (art: ArtworkView) => void; onAdd: () => void }) {
  return <main><section className="shop-hero"><Image src="https://images.unsplash.com/photo-1618331833071-ce81bd50d300?auto=format&fit=crop&w=1800&q=90" alt="Pintura abstrata azul, branca e amarela" fill priority sizes="100vw" /><div className="hero-overlay" /><div className="hero-copy"><p className="eyebrow">Curadoria de setembro</p><h1>Arte que transforma<br />o jeito de <em>habitar.</em></h1><p>Obras originais, histórias singulares e artistas de todo o Brasil.</p><Button kind="gold" onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}>Explorar curadoria</Button></div></section>
    {user.role === 'artist' && <section className={`artist-status status-${user.artistStatus}`}><div><span className="status-dot" /><p><strong>{user.artistStatus === 'approved' ? `Bem-vindo ao seu ateliê, ${user.name.split(' ')[0]}` : 'Seu perfil está em análise'}</strong>{user.artistStatus === 'approved' ? 'Sua vitrine está ativa e pronta para receber novas obras.' : 'Nossa curadoria responderá em até 48 horas. Enquanto isso, explore a loja.'}</p></div>{user.artistStatus === 'approved' && <Button kind="outline" onClick={onAdd}>Publicar nova obra</Button>}</section>}
    <section className="catalog" id="catalogo"><div className="catalog-top"><div><p className="eyebrow">Descubra sua próxima obra</p><h2>Galeria em destaque</h2></div><p>{artworks.length} de {total || artworks.length} obras</p></div><div className="filters">{[...filters, 'Favoritos'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'Favoritos' ? `♥ Favoritos (${favorite.length})` : item}</button>)}</div>{artistFilter && <p className="artist-filter">Mostrando as obras de <strong>{artistFilter.name}</strong> <button type="button" onClick={clearArtist}>Ver todos os artistas ✕</button></p>}
      {artworks.length ? <div className="art-grid">{artworks.map((art, index) => <article className={`art-card ${index === 0 ? 'featured-card' : ''}`} key={art.id}><button type="button" className="art-image" onClick={() => select(art)}><Image src={art.image} alt={art.title} fill sizes="(max-width: 700px) 50vw, 25vw" /><span>Ver detalhes</span></button><button type="button" className={`favorite ${favorite.includes(art.id) ? 'active' : ''}`} onClick={() => toggleFavorite(art.id)} aria-label="Favoritar obra"><Icon name="heart" size={18} /></button><div className="art-meta"><div><p>{art.artistName}</p><h3>{art.title}</h3><span>{art.technique}{art.width && art.height ? ` · ${art.width} × ${art.height} cm` : ''}</span></div><div><strong>{currency(art.price)}</strong><button type="button" onClick={() => addCart(art)} aria-label="Adicionar ao carrinho"><Icon name="plus" size={16} /></button></div></div></article>)}</div> : <div className="empty-state"><Icon name="art" size={40} /><h3>{filter === 'Favoritos' ? 'Nenhuma obra favorita ainda' : 'Nenhuma obra encontrada'}</h3><p>{filter === 'Favoritos' ? 'Toque no coração de uma obra para guardá-la aqui.' : 'Experimente outro filtro para continuar explorando.'}</p><Button kind="outline" onClick={() => { setFilter('Todos'); clearArtist() }}>Ver todas</Button></div>}
    </section>
  </main>
}

function AddArtwork({ back, pending, submit }: { back: () => void; pending: boolean; submit: (data: FormData) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [submitType, setSubmitType] = useState('published')
  return <main className="editor-page"><button type="button" className="back-link" onClick={back}>← Voltar para a loja</button><div className="editor-heading"><div><p className="eyebrow">Nova publicação</p><h1>Conte a história da sua obra.</h1></div><p>Boas imagens e uma descrição cuidadosa ajudam colecionadores a se conectarem com seu trabalho.</p></div>
    <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)) }} className="art-editor"><input type="hidden" name="submitType" value={submitType} /><section className="upload-panel"><div className="section-number">01</div><div className="panel-title"><h2>Imagens da obra</h2><p>Adicione até 5 fotos. A primeira será usada como capa.</p></div><button type="button" className={`art-dropzone ${previews.length ? 'has-preview' : ''}`} onClick={() => fileRef.current?.click()}>{previews.length ? <Image src={previews[0]} alt="Prévia principal da obra" fill sizes="50vw" /> : <><span><Icon name="upload" size={26} /></span><strong>Selecione ou arraste imagens</strong><small>JPG, PNG ou WEBP · máximo 10 MB</small></>}</button><input ref={fileRef} className="sr-only" type="file" name="images" accept="image/*" multiple required onChange={(event) => setPreviews(Array.from(event.target.files ?? []).slice(0, 5).map(URL.createObjectURL))} />{previews.length > 0 && <div className="thumb-row">{previews.map((src, index) => <button type="button" key={src} onClick={() => fileRef.current?.click()}><Image src={src} alt={`Imagem ${index + 1}`} fill sizes="100px" />{index === 0 && <span>Capa</span>}</button>)}{previews.length < 5 && <button type="button" className="add-thumb" onClick={() => fileRef.current?.click()}><Icon name="plus" /></button>}</div>}<div className="photo-tips"><strong>Para uma boa apresentação</strong><ul><li>Use luz natural e fundo neutro</li><li>Fotografe a obra de frente</li><li>Inclua um detalhe da textura</li></ul></div></section>
      <section className="details-panel"><div className="section-number">02</div><div className="panel-title"><h2>Detalhes da obra</h2><p>Informações que ajudam a contextualizar e vender seu trabalho.</p></div><div className="form-stack"><Field label="Título da obra" name="title" placeholder="Ex.: Entardecer no Cerrado" required /><label className="field"><span>Técnica</span><select name="technique" required><option value="">Selecione uma técnica</option>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><div className="form-grid three"><Field label="Largura (cm)" name="width" type="number" placeholder="60" step="0.01" min="0.01" required /><Field label="Altura (cm)" name="height" type="number" placeholder="80" step="0.01" min="0.01" required /><Field label="Ano" name="year" type="number" defaultValue={String(new Date().getFullYear())} required /></div><label className="field"><span>História e processo criativo</span><textarea name="description" rows={6} placeholder="Conte sobre as inspirações, materiais e o processo por trás desta obra…" required /></label><Field label="Valor de venda (R$)" name="price" type="number" placeholder="1200" step="0.01" min="0.01" required /></div><div className="editor-actions"><Button type="submit" kind="outline" disabled={pending} onClick={() => setSubmitType('draft')}>Salvar rascunho</Button><Button type="submit" kind="gold" disabled={pending} onClick={() => setSubmitType('published')}>{pending ? 'Publicando…' : 'Publicar obra'}</Button></div></section>
    </form>
  </main>
}

function Admin({ candidates: initial, artworks, user, theme, toggleTheme, back, review, reload, pending, logout }: { candidates: ArtistCandidate[]; artworks: ArtworkView[]; reload: () => void; user: UserView; theme: 'light' | 'dark'; toggleTheme: () => void; back: () => void; review: (id: string, decision: 'approved' | 'rejected', note: string) => void; pending: boolean; logout: () => void }) {
  const [tab, setTab] = useState<'approvals' | 'artists' | 'artworks' | 'orders' | 'reports'>('approvals')
  const [candidates, setCandidates] = useState(initial)
  const [selected, setSelected] = useState<ArtistCandidate | null>(initial[0] ?? null)
  const [artists, setArtists] = useState(() => Array.from(new Set(artworks.map((art) => art.artistName))).map((name, index) => ({
    id: `catalog-artist-${index}`,
    name,
    style: artworks.find((art) => art.artistName === name)?.technique ?? 'Técnica mista',
    location: ['São Paulo · SP', 'Rio de Janeiro · RJ', 'Belo Horizonte · MG', 'Curitiba · PR', 'Recife · PE', 'Brasília · DF'][index % 6],
    artworks: artworks.filter((art) => art.artistName === name).length,
  })))
  const [note, setNote] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [reports, setReports] = useState<ReportsView | null>(null)
  const [adminOrders, setAdminOrders] = useState<AdminOrderView[] | null>(null)
  const [dataFailed, setDataFailed] = useState(false)
  const loadData = useCallback(async () => {
    try {
      const [nextReports, nextOrders] = await Promise.all([getReports(), listAdminOrders()])
      setReports(nextReports)
      setAdminOrders(nextOrders)
      setDataFailed(false)
    } catch {
      setDataFailed(true)
    }
  }, [])
  useEffect(() => { if (tab === 'orders' || tab === 'reports') void loadData() }, [tab, loadData])
  const headings = {
    approvals: ['Curadoria de artistas', 'Analise novas solicitações e seus portfólios.'],
    artists: ['Todos os artistas', 'Acompanhe os artistas ativos na Nambá Galerie.'],
    artworks: ['Gestão de obras', 'Visualize o catálogo publicado na plataforma.'],
    orders: ['Pedidos', 'Todas as compras feitas na Nambá Galerie.'],
    reports: ['Relatórios e estatísticas', 'Acompanhe os principais números da Nambá Galerie.'],
  }

  const [artworkBusy, setArtworkBusy] = useState<string | null>(null)
  const [artworkNotice, setArtworkNotice] = useState<{ text: string; error?: boolean } | null>(null)
  async function toggleVisibility(art: ArtworkView) {
    setArtworkBusy(art.id)
    const result = await setArtworkVisibilityAction(art.id, art.status === 'hidden')
    setArtworkNotice({ text: result.message, error: !result.ok })
    setArtworkBusy(null)
    reload()
  }
  function exportArtworks() {
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const rows = [['Obra', 'Artista', 'Técnica', 'Valor (R$)', 'Situação'], ...artworks.map((art) => [art.title, art.artistName, art.technique, art.price.toFixed(2).replace('.', ','), artworkStatusLabel[art.status] ?? art.status])]
    const csv = '\ufeff' + rows.map((row) => row.map(cell).join(';')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'obras-namba-galerie.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function decide(decision: 'approved' | 'rejected') {
    if (!selected) return
    review(selected.id, decision, note)
    if (decision === 'approved') {
      setArtists((current) => current.some((artist) => artist.name === selected.name) ? current : [...current, {
        id: selected.id,
        name: selected.name,
        style: selected.artStyle,
        location: `${selected.city}${selected.state ? ` · ${selected.state}` : ''}`,
        artworks: 0,
      }])
    }
    const next = candidates.filter((item) => item.id !== selected.id)
    setCandidates(next)
    setSelected(next[0] ?? null)
    setNote('')
  }
  return <main className="admin-page"><aside className="admin-sidebar"><Logo light /><div className="admin-user"><span>{user.name.charAt(0)}</span><p><strong>{user.name}</strong><small>Curadoria Nambá</small></p></div><nav><button className={tab === 'approvals' ? 'active' : ''} type="button" onClick={() => setTab('approvals')}><span>01</span>Aprovações <b>{candidates.length}</b></button><button className={tab === 'artists' ? 'active' : ''} type="button" onClick={() => setTab('artists')}><span>02</span>Artistas</button><button className={tab === 'artworks' ? 'active' : ''} type="button" onClick={() => setTab('artworks')}><span>03</span>Obras</button><button className={tab === 'orders' ? 'active' : ''} type="button" onClick={() => setTab('orders')}><span>04</span>Pedidos</button><button className={tab === 'reports' ? 'active' : ''} type="button" onClick={() => setTab('reports')}><span>05</span>Relatórios</button></nav><button type="button" className="admin-theme-toggle" onClick={toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /> Modo {theme === 'dark' ? 'claro' : 'escuro'}</button><button type="button" className="sidebar-exit" onClick={logout}><Icon name="logout" size={18} /> Sair</button></aside>
    <section className="admin-main"><header><div><p className="eyebrow">Painel administrativo</p><h1>{headings[tab][0]}</h1><p className="admin-subtitle">{headings[tab][1]}</p></div><Button kind="outline" onClick={back}>Visualizar loja</Button></header><div className="admin-stats"><article><span>Pendentes</span><strong>{candidates.length}</strong><small>aguardando análise</small></article><article><span>Aprovados</span><strong>{artists.length}</strong><small>artistas ativos</small></article><article><span>Obras</span><strong>{artworks.length}</strong><small>no catálogo</small></article></div>
      {tab === 'approvals' && <div className="review-layout"><section className="candidate-list"><div className="list-heading"><h2>Novas solicitações</h2><span>{candidates.length}</span></div>{candidates.length ? candidates.map((candidate) => <button type="button" key={candidate.id} className={selected?.id === candidate.id ? 'active' : ''} onClick={() => setSelected(candidate)}><span className="candidate-avatar">{candidate.name.charAt(0)}</span><div><strong>{candidate.name}</strong><small>{candidate.artStyle}</small><em>{candidate.city}{candidate.state ? ` · ${candidate.state}` : ''}</em></div><Icon name="arrow" size={17} /></button>) : <div className="list-empty"><Icon name="check" /><p>Fila concluída</p><small>Não há artistas aguardando análise.</small></div>}</section>
        <section className="candidate-detail">{selected ? <><div className="candidate-heading"><div><span className="candidate-avatar large">{selected.name.charAt(0)}</span><div><p className="eyebrow">Candidatura de artista</p><h2>{selected.name}</h2><span>{selected.email} · {selected.city}{selected.state ? `, ${selected.state}` : ''}</span></div></div><small>Enviado em {new Date(selected.createdAt).toLocaleDateString('pt-BR')}</small></div><div className="candidate-bio"><span>Pesquisa artística</span><h3>{selected.artStyle}</h3><p>{selected.artistBio || 'O artista ainda não adicionou uma descrição detalhada.'}</p></div><div className="portfolio-heading"><div><span>Portfólio enviado</span><strong>{selected.portfolio.length} obras</strong></div><p>Clique em uma imagem para ampliar e observar os detalhes.</p></div>{selected.portfolio.length ? <div className="portfolio-grid">{selected.portfolio.map((src, index) => <button type="button" key={src} onClick={() => setLightbox(src)}><Image src={src} alt={`Obra ${index + 1} do portfólio de ${selected.name}`} fill sizes="25vw" /><span>Ampliar</span></button>)}</div> : <div className="portfolio-empty">Nenhuma imagem de portfólio foi anexada.</div>}<label className="field review-field"><span>Observação para o artista (opcional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Explique sua decisão ou solicite ajustes…" /></label><div className="review-actions"><Button kind="danger" disabled={pending} onClick={() => decide('rejected')}><Icon name="close" size={17} /> Rejeitar</Button><Button kind="gold" disabled={pending} onClick={() => decide('approved')}><Icon name="check" size={17} /> Aprovar artista</Button></div></> : <div className="review-complete"><span><Icon name="check" size={32} /></span><h2>Curadoria em dia</h2><p>Todos os cadastros foram analisados.</p></div>}</section>
      </div>}
      {tab === 'artists' && <section className="admin-panel"><div className="panel-heading"><div><h2>Artistas ativos</h2><p>{artists.length} perfis disponíveis na plataforma</p></div><label className="admin-search"><span>Buscar</span><input placeholder="Nome ou técnica" /></label></div><div className="artist-admin-grid">{artists.map((artist) => <article key={artist.id}><span className="candidate-avatar large">{artist.name.charAt(0)}</span><div><h3>{artist.name}</h3><p>{artist.style}</p><small>{artist.location}</small></div><dl><div><dt>Obras</dt><dd>{artist.artworks}</dd></div><div><dt>Status</dt><dd className="status-active">Ativo</dd></div></dl><Button kind="outline">Ver perfil</Button></article>)}</div></section>}
      {tab === 'artworks' && <section className="admin-panel"><div className="panel-heading"><div><h2>Catálogo de obras</h2><p>{artworks.length} obras cadastradas</p></div><Button kind="outline" onClick={exportArtworks}>Exportar lista</Button></div>{artworkNotice && <p className={`orders-notice ${artworkNotice.error ? 'is-error' : 'is-ok'}`} role="status">{artworkNotice.text}</p>}<div className="artwork-admin-table"><div className="table-head"><span>Obra</span><span>Artista</span><span>Técnica</span><span>Valor</span><span>Status</span><span>Ação</span></div>{artworks.map((artwork) => <article key={artwork.id}><div className="admin-artwork-title"><div>{artwork.image && <Image src={artwork.image} alt="" fill sizes="54px" />}</div><strong>{artwork.title}</strong></div><span>{artwork.artistName}</span><span>{artwork.technique}</span><strong>{currency(artwork.price)}</strong><em>{artworkStatusLabel[artwork.status] ?? artwork.status}</em>{artwork.status === 'published' || artwork.status === 'hidden' ? <Button kind="outline" disabled={artworkBusy === artwork.id} onClick={() => void toggleVisibility(artwork)}>{artwork.status === 'hidden' ? 'Republicar' : 'Despublicar'}</Button> : <span />}</article>)}</div></section>}
      {tab === 'orders' && <section className="admin-panel"><div className="panel-heading"><div><h2>Todos os pedidos</h2><p>{adminOrders ? `${adminOrders.length} pedidos registrados` : 'Carregando…'}</p></div></div>
        {dataFailed ? <DataError retry={() => void loadData()} /> : adminOrders && (adminOrders.length ? <div className="orders-list">{adminOrders.map((order) => <article className="order-card" key={order.id}>
          <header><div><strong>Pedido {order.number}</strong><span>{dateTime(order.createdAt)} · {order.buyerName} ({order.buyerEmail})</span></div><em className={`order-status status-${order.status}`}>{orderStatusLabel[order.status]}</em></header>
          <div className="order-items">{order.items.map((item) => <div key={item.artworkId}><div className="order-thumb"><Image src={item.image} alt={item.title} fill sizes="64px" /></div><p><strong>{item.title}</strong><span>{item.artistName}</span></p><b>{currency(item.price)}</b></div>)}</div>
          <dl className="order-info"><div><dt>Pagamento</dt><dd>{order.paymentMethod ? paymentMethodLabel[order.paymentMethod] : '—'}</dd></div><div><dt>Entrega</dt><dd>{order.address.street}, {order.address.number} · {order.address.city}/{order.address.state}</dd></div><div><dt>Total</dt><dd><strong>{currency(order.total)}</strong></dd></div></dl>
          {order.shipment && <ShipmentInfo shipment={order.shipment} />}
          <ShipmentControls orderId={order.id} canShip={order.canShip} canDeliver={order.canDeliver} address={order.address} recipient={order.buyerName} done={() => void loadData()} />
        </article>)}</div> : <div className="account-empty"><span><Icon name="bag" size={25} /></span><h3>Nenhum pedido ainda</h3><p>Quando alguém comprar uma obra, o pedido aparece aqui.</p></div>)}
      </section>}
      {tab === 'reports' && <section className="reports-layout">{dataFailed ? <DataError retry={() => void loadData()} /> : !reports ? <p>Carregando…</p> : <>
        <div className="report-cards"><article><span>Receita</span><strong>{currency(reports.revenue)}</strong><small>pedidos pagos, sem frete</small></article><article><span>Pedidos pagos</span><strong>{reports.paidOrders}</strong><small>pagos, enviados ou entregues</small></article><article><span>Ticket médio</span><strong>{currency(reports.averageTicket)}</strong><small>por pedido pago</small></article></div>
        <div className="reports-grid">
          <section><div className="panel-heading"><div><h2>Vendas por técnica</h2><p>Obras vendidas em pedidos pagos</p></div></div>{reports.salesByTechnique.length ? <div className="technique-report">{reports.salesByTechnique.map((item) => <div key={item.technique}><p><span>{item.technique}</span><strong>{item.sold} · {currency(item.revenue)}</strong></p><meter min="0" max={Math.max(...reports.salesByTechnique.map((entry) => entry.sold), 1)} value={item.sold} /></div>)}</div> : <p className="report-empty">Ainda não há vendas pagas.</p>}</section>
          <section><div className="panel-heading"><div><h2>Artistas que mais vendem</h2><p>Por receita em pedidos pagos</p></div></div>{reports.topArtists.length ? <ol className="top-artists">{reports.topArtists.map((artist) => <li key={artist.name}><span>{artist.name}</span><small>{artist.sold} {artist.sold === 1 ? 'obra' : 'obras'}</small><strong>{currency(artist.revenue)}</strong></li>)}</ol> : <p className="report-empty">Ainda não há vendas pagas.</p>}</section>
          <section><div className="panel-heading"><div><h2>Pedidos por situação</h2><p>Todos os pedidos registrados</p></div></div><div className="curation-summary">{(Object.keys(orderStatusLabel) as OrderStatus[]).map((status) => <div key={status}><span className={`summary-dot order-${status}`} /><p><strong>{reports.ordersByStatus[status] ?? 0}</strong>{orderStatusLabel[status]}</p></div>)}</div></section>
          <section><div className="panel-heading"><div><h2>Catálogo e curadoria</h2><p>Situação atual das obras e dos perfis</p></div></div><div className="curation-summary"><div><span className="summary-dot approved" /><p><strong>{reports.catalog.onSale}</strong>À venda</p></div><div><span className="summary-dot catalogued" /><p><strong>{reports.catalog.outOfStock}</strong>Vendidas ou reservadas</p></div><div><span className="summary-dot pending" /><p><strong>{candidates.length}</strong>Artistas pendentes</p></div></div></section>
        </div></>}</section>}
    </section>{lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><button type="button" aria-label="Fechar"><Icon name="close" /></button><div><Image src={lightbox} alt="Obra ampliada do portfólio" fill sizes="90vw" /></div></div>}</main>
}

function Account({ user, artworks, back, initialTab = 'personal', onOrdersChange }: { user: UserView; artworks: ArtworkView[]; back: () => void; initialTab?: 'personal' | 'orders' | 'sales'; onOrdersChange?: () => void }) {
  const [tab, setTab] = useState<'personal' | 'addresses' | 'orders' | 'sales' | 'artworks' | 'security'>(initialTab)
  const tabs = [
    { id: 'personal' as const, label: 'Dados pessoais' },
    { id: 'addresses' as const, label: 'Endereços' },
    { id: 'orders' as const, label: 'Pedidos' },
    ...(user.role === 'artist' ? [{ id: 'artworks' as const, label: 'Minhas obras' }, { id: 'sales' as const, label: 'Minhas vendas' }] : []),
    { id: 'security' as const, label: 'Segurança' },
  ]

  return <main className="account-page"><button type="button" className="back-link" onClick={back}>← Voltar para a loja</button><div className="account-header"><span>{user.name.charAt(0)}</span><div><p className="eyebrow">Minha conta</p><h1>{user.name}</h1><p>{user.role === 'buyer' ? 'Perfil de comprador' : user.role === 'artist' ? 'Perfil de artista' : 'Perfil administrativo'}{user.city ? ` · ${user.city}` : ''}</p></div></div><div className="account-grid"><aside>{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} type="button" onClick={() => setTab(item.id)}>{item.label}</button>)}</aside>
    <section>
      {tab === 'personal' && <PersonalPanel user={user} onSaved={onOrdersChange} />}
      {tab === 'addresses' && <AddressesPanel onChange={onOrdersChange} />}
      {tab === 'orders' && <OrdersPanel back={back} onChange={onOrdersChange} />}
      {tab === 'sales' && <SalesPanel />}
      {tab === 'artworks' && <MyArtworks artworks={artworks.filter((art) => art.artistId === user.id)} onChange={onOrdersChange} />}
      {tab === 'security' && <SecurityPanel />}
    </section>
  </div></main>
}

const orderStatusLabel: Record<OrderStatus, string> = { pending: 'Aguardando pagamento', paid: 'Pago', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const paymentMethodLabel: Record<PaymentMethod, string> = { pix: 'Pix', boleto: 'Boleto', credit: 'Cartão de crédito' }
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function OrdersPanel({ back, onChange }: { back: () => void; onChange?: () => void }) {
  const [orders, setOrders] = useState<OrderView[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setOrders(await listOrders())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(id: string, action: (id: string) => Promise<ActionResult>) {
    setBusy(id)
    const result = await action(id)
    setNotice({ text: result.message, error: !result.ok })
    setBusy(null)
    await load()
    onChange?.() // a vitrine muda quando uma obra volta ou é vendida
  }

  if (failed) return <><h2>Meus pedidos</h2><div className="account-empty"><h3>Não foi possível carregar seus pedidos</h3><p>Verifique sua conexão e tente novamente.</p><Button kind="gold" onClick={() => void load()}>Tentar novamente</Button></div></>
  if (!orders) return <><h2>Meus pedidos</h2><p>Carregando…</p></>
  if (!orders.length) return <><h2>Meus pedidos</h2><p>Acompanhe suas compras e consulte pedidos anteriores.</p><div className="account-empty"><span><Icon name="bag" size={25} /></span><h3>Você ainda não fez nenhum pedido</h3><p>As obras compradas e o andamento das entregas aparecerão nesta área.</p><Button kind="gold" onClick={back}>Explorar obras</Button></div></>

  return <><h2>Meus pedidos</h2><p>Acompanhe suas compras e consulte pedidos anteriores.</p>
    {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
    <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}>
      <header><div><strong>Pedido {order.number}</strong><span>{dateTime(order.createdAt)}</span></div><em className={`order-status status-${order.status}`}>{orderStatusLabel[order.status]}</em></header>
      <div className="order-items">{order.items.map((item) => <div key={item.artworkId}><div className="order-thumb"><Image src={item.image} alt={item.title} fill sizes="64px" /></div><p><strong>{item.title}</strong><span>{item.artistName}</span></p><b>{currency(item.price)}</b></div>)}</div>
      <dl className="order-info">
        <div><dt>Pagamento</dt><dd>{order.paymentMethod ? paymentMethodLabel[order.paymentMethod] : '—'}</dd></div>
        <div><dt>Entrega</dt><dd>{order.address.street}, {order.address.number} · {order.address.city}/{order.address.state}</dd></div>
        <div><dt>Total</dt><dd><strong>{currency(order.total)}</strong></dd></div>
      </dl>
      {order.shipment && <ShipmentInfo shipment={order.shipment} />}
      {order.status === 'pending' && order.expiresAt && <p className="order-deadline">Reservado até {dateTime(order.expiresAt)}. Depois disso o pedido é cancelado e a obra volta à vitrine.</p>}
      {(order.canSimulatePayment || order.canCancel) && <div className="order-actions">
        {order.canSimulatePayment && <Button kind="gold" disabled={busy === order.id} onClick={() => void act(order.id, simulatePaymentAction)}>Simular pagamento (teste)</Button>}
        {order.canCancel && <Button kind="outline" disabled={busy === order.id} onClick={() => { if (window.confirm('Cancelar este pedido? As obras voltam para a vitrine.')) void act(order.id, cancelOrderAction) }}>Cancelar pedido</Button>}
      </div>}
    </article>)}</div></>
}

function ShipmentInfo({ shipment }: { shipment: Shipment }) {
  const date = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
  return <p className="shipment-info"><strong>{shipment.carrier || 'Transportadora'}</strong> · rastreio <b>{shipment.trackingCode}</b>{shipment.shippedAt && <> · enviado em {date(shipment.shippedAt)}</>}{shipment.deliveredAt && <> · entregue em {date(shipment.deliveredAt)}</>}</p>
}

// Marcar envio (com código de rastreio) e entrega. Usado pelo artista (Minhas vendas) e pelo administrador (Pedidos).
function ShipmentControls({ orderId, canShip, canDeliver, address, recipient, done }: { orderId: string; canShip: boolean; canDeliver: boolean; address?: Address | null; recipient?: string; done: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function act(request: () => Promise<ActionResult>) {
    setBusy(true)
    const result = await request()
    setNotice({ text: result.message, error: !result.ok })
    setBusy(false)
    if (result.ok) done()
  }

  if (!canShip && !canDeliver) return null
  return <div className="shipment-controls">
    {canShip && <>
      {address && <p className="ship-to"><strong>Enviar para{recipient ? ` ${recipient}` : ''}:</strong> {address.street}, {address.number}{address.complement ? ` – ${address.complement}` : ''} · {address.neighborhood} · {address.city}/{address.state} · CEP {address.cep}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void act(() => shipOrderAction(orderId, code)) }}>
        <label className="field"><span>Código de rastreio (Correios)</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex.: AA123456789BR" maxLength={60} required /></label>
        <Button type="submit" kind="gold" disabled={busy}>Marcar como enviado</Button>
      </form>
    </>}
    {canDeliver && <Button kind="gold" disabled={busy} onClick={() => void act(() => deliverOrderAction(orderId))}>Marcar como entregue</Button>}
    {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
  </div>
}

function MyArtworks({ artworks, onChange }: { artworks: ArtworkView[]; onChange?: () => void }) {
  const [editing, setEditing] = useState<ArtworkView | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [formError, setFormError] = useState('')
  const submitType = useRef<'publish' | 'draft'>('publish') // qual botão de salvar foi clicado

  async function run(request: () => Promise<ActionResult>, onOk?: () => void) {
    setBusy(true)
    const result = await request()
    setBusy(false)
    if (result.ok) {
      setNotice({ text: result.message })
      setFormError('')
      onOk?.()
      onChange?.()
    } else if (editing) {
      setFormError(result.message)
    } else {
      setNotice({ text: result.message, error: true })
    }
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? '')
    void run(() => updateArtworkAction(editing.id, { title: field('title'), technique: field('technique'), description: field('description'), price: field('price'), width: field('width'), height: field('height'), year: field('year'), submitType: submitType.current }), () => setEditing(null))
  }

  if (editing) {
    return <><h2>Editar obra</h2><p>Altere os dados e escolha se ela fica publicada ou volta a ser rascunho. As imagens não mudam por aqui.</p>
      <form className="form-stack" onSubmit={save}>
        <Field label="Título da obra" name="title" defaultValue={editing.title} required />
        <label className="field"><span>Técnica</span><select name="technique" defaultValue={editing.technique} required>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="form-grid three"><Field label="Largura (cm)" name="width" type="number" step="0.01" min="0.01" defaultValue={editing.width ? String(editing.width) : ''} /><Field label="Altura (cm)" name="height" type="number" step="0.01" min="0.01" defaultValue={editing.height ? String(editing.height) : ''} /><Field label="Ano" name="year" type="number" defaultValue={editing.year ? String(editing.year) : ''} /></div>
        <label className="field"><span>História e processo criativo</span><textarea name="description" rows={5} defaultValue={editing.description} /></label>
        <Field label="Valor de venda (R$)" name="price" type="number" step="0.01" min="0.01" defaultValue={String(editing.price)} required />
        {formError && <p className="orders-notice is-error" role="alert">{formError}</p>}
        <div className="editor-actions edit-actions">
          <Button kind="ghost" onClick={() => { setEditing(null); setFormError('') }}>Cancelar</Button>
          <Button type="submit" kind="outline" disabled={busy} onClick={() => { submitType.current = 'draft' }}>Salvar como rascunho</Button>
          <Button type="submit" kind="gold" disabled={busy} onClick={() => { submitType.current = 'publish' }}>Salvar e publicar</Button>
        </div>
      </form></>
  }

  if (!artworks.length) return <><h2>Minhas obras</h2><p>Gerencie as obras que você publicou.</p><div className="account-empty"><span><Icon name="art" size={25} /></span><h3>Você ainda não publicou obras</h3><p>Use o botão "Adicionar arte" no topo para publicar a primeira.</p></div></>

  return <><h2>Minhas obras</h2><p>Edite, tire da vitrine ou exclua as suas obras. Obras reservadas ou vendidas não podem ser alteradas.</p>
    {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
    <div className="orders-list">{artworks.map((art) => {
      const locked = art.status === 'reserved' || art.status === 'sold' || art.status === 'hidden'
      return <article className="order-card" key={art.id}>
        <div className="order-items"><div><div className="order-thumb"><Image src={art.image} alt={art.title} fill sizes="64px" /></div><p><strong>{art.title}</strong><span>{art.technique} · {artworkStatusLabel[art.status] ?? art.status}</span></p><b>{currency(art.price)}</b></div></div>
        {art.status === 'hidden' && <p className="order-deadline">Esta obra foi despublicada pela curadoria. Fale com a administração para republicá-la.</p>}
        {!locked && <div className="order-actions">
          <Button kind="outline" disabled={busy} onClick={() => { setNotice(null); submitType.current = art.status === 'draft' ? 'draft' : 'publish'; setEditing(art) }}>Editar</Button>
          <Button kind="outline" disabled={busy} onClick={() => void run(() => updateArtworkAction(art.id, { title: art.title, technique: art.technique, description: art.description, price: String(art.price), width: art.width ? String(art.width) : '', height: art.height ? String(art.height) : '', year: art.year ? String(art.year) : '', submitType: art.status === 'draft' ? 'publish' : 'draft' }))}>{art.status === 'draft' ? 'Publicar' : 'Tirar da vitrine'}</Button>
          <Button kind="danger" disabled={busy} onClick={() => { if (window.confirm(`Excluir “${art.title}”? Isso não pode ser desfeito.`)) void run(() => deleteArtworkAction(art.id)) }}>Excluir</Button>
        </div>}
      </article>
    })}</div></>
}

function PersonalPanel({ user, onSaved }: { user: UserView; onSaved?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? '')
    setBusy(true)
    const result = await updateProfileAction({ name: field('name'), phone: field('phone'), city: field('city'), state: field('state'), bio: field('bio'), birthDate: field('birthDate') })
    setBusy(false)
    setNotice({ text: result.message, error: !result.ok })
    if (result.ok) onSaved?.()
  }

  return <><h2>Dados pessoais</h2><p>Mantenha suas informações atualizadas. O e-mail é o seu login e não pode ser alterado por aqui.</p>
    <form className="form-stack" onSubmit={(event) => void save(event)}>
      <div className="form-grid"><Field label="Nome completo" name="name" defaultValue={user.name} required /><Field label="Celular (com DDD)" name="phone" type="tel" defaultValue={user.phone ?? ''} placeholder="(11) 99999-9999" /></div>
      <div className="form-grid"><Field label="Data de nascimento" name="birthDate" type="date" defaultValue={user.birthDate ?? ''} /><Field label="Cidade" name="city" defaultValue={user.city} /></div><div className="form-grid"><Field label="Estado (UF)" name="state" defaultValue={user.state ?? ''} placeholder="SP" /><span /></div>
      {user.role === 'artist' && <label className="field"><span>Sua pesquisa artística</span><textarea name="bio" rows={5} defaultValue={user.bio ?? ''} required minLength={60} maxLength={2000} /></label>}
      <div className="form-grid"><label className="field"><span>E-mail</span><input value={user.email} readOnly disabled /></label><label className="field"><span>Perfil</span><input value={user.role === 'buyer' ? 'Comprador' : user.role === 'artist' ? 'Artista' : 'Administrador'} readOnly disabled /></label></div>
      {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
      <div><Button type="submit" kind="gold" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</Button></div>
    </form></>
}

function AddressesPanel({ onChange }: { onChange?: () => void }) {
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState<{ id?: string; value: Address } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    try {
      setAddresses(await listAddresses())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setBusy(true)
    const result = await saveAddressAction(editing.value, editing.id)
    setBusy(false)
    if (!result.ok) { setFormError(result.message); return }
    setNotice({ text: result.message })
    setEditing(null)
    setFormError('')
    await load()
    onChange?.() // o checkout usa o primeiro endereço como sugestão
  }

  async function remove(address: SavedAddress) {
    if (!window.confirm(`Excluir o endereço ${address.street}, ${address.number}?`)) return
    setBusy(true)
    const result = await deleteAddressAction(address.id)
    setBusy(false)
    setNotice({ text: result.message, error: !result.ok })
    await load()
    onChange?.()
  }

  if (failed) return <><h2>Endereços</h2><DataError retry={() => void load()} /></>
  if (!addresses) return <><h2>Endereços</h2><p>Carregando…</p></>

  if (editing) {
    return <><h2>{editing.id ? 'Editar endereço' : 'Novo endereço'}</h2><p>Digite o CEP para preencher rua, bairro e cidade automaticamente.</p>
      <form className="form-stack" onSubmit={(event) => void save(event)}>
        <AddressFields value={editing.value} onChange={(value) => setEditing({ ...editing, value })} strict />
        {formError && <p className="orders-notice is-error" role="alert">{formError}</p>}
        <div className="editor-actions edit-actions"><Button kind="ghost" onClick={() => { setEditing(null); setFormError('') }}>Cancelar</Button><Button type="submit" kind="gold" disabled={busy}>{busy ? 'Salvando…' : 'Salvar endereço'}</Button></div>
      </form></>
  }

  return <><div className="account-section-heading"><div><h2>Endereços</h2><p>Gerencie os locais usados para entrega das suas obras. O primeiro da lista é sugerido no checkout.</p></div><Button kind="outline" onClick={() => { setNotice(null); setEditing({ value: emptyAddress }) }}>Adicionar endereço</Button></div>
    {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
    {addresses.length ? <div className="orders-list">{addresses.map((address) => <article className="order-card" key={address.id}>
      <div className="address-card"><p><strong>{address.street}, {address.number}{address.complement ? ` – ${address.complement}` : ''}</strong><span>{address.neighborhood} · {address.city}/{address.state} · CEP {address.cep}</span></p>
        <div className="order-actions"><Button kind="outline" disabled={busy} onClick={() => { setNotice(null); setEditing({ id: address.id, value: { cep: address.cep, street: address.street, number: address.number, complement: address.complement, neighborhood: address.neighborhood, city: address.city, state: address.state } }) }}>Editar</Button><Button kind="danger" disabled={busy} onClick={() => void remove(address)}>Excluir</Button></div></div>
    </article>)}</div> : <div className="account-empty"><span><Icon name="user" size={25} /></span><h3>Nenhum endereço cadastrado</h3><p>Quando você adicionar um endereço, ele aparecerá aqui para facilitar suas próximas compras.</p><Button kind="gold" onClick={() => setEditing({ value: emptyAddress })}>Cadastrar primeiro endereço</Button></div>}</>
}

function SecurityPanel() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const field = (name: string) => String(data.get(name) ?? '')
    if (field('newPassword') !== field('confirmPassword')) { setNotice({ text: 'A confirmação não é igual à nova senha.', error: true }); return }
    setBusy(true)
    const result = await changePasswordAction(field('currentPassword'), field('newPassword'))
    setBusy(false)
    setNotice({ text: result.message, error: !result.ok })
    if (result.ok) form.reset()
  }

  return <><h2>Segurança</h2><p>Troque a senha de acesso da sua conta.</p>
    <form className="form-stack" onSubmit={(event) => void save(event)}>
      <label className="field"><span>Senha atual</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <div className="form-grid"><label className="field"><span>Nova senha (mínimo 8 caracteres)</span><input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label><label className="field"><span>Repita a nova senha</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label></div>
      {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
      <div><Button type="submit" kind="gold" disabled={busy}>{busy ? 'Salvando…' : 'Trocar senha'}</Button></div>
    </form></>
}

function ForgotPassword({ back }: { back: () => void }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await forgotPasswordAction(String(new FormData(event.currentTarget).get('email') ?? ''))
    setBusy(false)
    setNotice({ text: result.message, error: !result.ok })
  }

  return <main className="auth-simple"><section><Logo /><p className="eyebrow">Recuperar acesso</p><h1>Esqueceu a senha?</h1><p>Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</p>
    <form className="form-stack" onSubmit={(event) => void send(event)}>
      <label className="field"><span>E-mail</span><input name="email" type="email" autoComplete="email" placeholder="seu@email.com" required /></label>
      {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
      <Button type="submit" kind="gold" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</Button>
      <button type="button" className="link-button" onClick={back}>← Voltar para o login</button>
    </form></section></main>
}

function ResetPassword({ token, done }: { token: string; done: () => void }) {
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('newPassword') ?? '')
    if (password !== String(data.get('confirmPassword') ?? '')) { setNotice({ text: 'A confirmação não é igual à nova senha.', error: true }); return }
    setBusy(true)
    const result = await resetPasswordAction(token, password)
    setBusy(false)
    setNotice({ text: result.message, error: !result.ok })
    if (result.ok) setFinished(true)
  }

  return <main className="auth-simple"><section><Logo /><p className="eyebrow">Recuperar acesso</p><h1>Crie uma nova senha</h1>
    {finished ? <><p>{notice?.text}</p><Button kind="gold" onClick={done}>Ir para o login</Button></> : <form className="form-stack" onSubmit={(event) => void save(event)}>
      <label className="field"><span>Nova senha (mínimo 8 caracteres)</span><input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <label className="field"><span>Repita a nova senha</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
      <Button type="submit" kind="gold" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</Button>
      <button type="button" className="link-button" onClick={done}>← Voltar para o login</button>
    </form>}</section></main>
}

function ArtistsPage({ openArtist }: { openArtist: (artist: PublicArtist) => void }) {
  const [artists, setArtists] = useState<PublicArtist[] | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(async () => {
    try {
      setArtists(await listPublicArtists())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  return <main className="browse-page"><p className="eyebrow">Quem cria</p><h1>Artistas</h1><p className="browse-intro">Conheça quem pinta, desenha e cria as obras da Nambá Galerie.</p>
    {failed ? <DataError retry={() => void load()} /> : !artists ? <p>Carregando…</p> : artists.length ? <div className="browse-grid">{artists.map((artist) => <article className="browse-card" key={artist.id}>
      <div className="browse-cover">{artist.cover ? <Image src={artist.cover} alt={`Obra de ${artist.name}`} fill sizes="(max-width: 700px) 100vw, 33vw" /> : <span>{artist.name.charAt(0)}</span>}</div>
      <div className="browse-body"><h2>{artist.name}</h2><small>{[artist.city, artist.state].filter(Boolean).join(' · ') || 'Brasil'}{artist.artStyle ? ` · ${artist.artStyle}` : ''}</small>{artist.bio && <p>{artist.bio.length > 140 ? `${artist.bio.slice(0, 140)}…` : artist.bio}</p>}<Button kind="outline" onClick={() => openArtist(artist)}>Ver {artist.works} {artist.works === 1 ? 'obra' : 'obras'}</Button></div>
    </article>)}</div> : <div className="account-empty"><span><Icon name="art" size={25} /></span><h3>Ainda não há artistas com obras à venda</h3><p>Volte em breve.</p></div>}
  </main>
}

function CollectionsPage({ artworks, openCollection }: { artworks: ArtworkView[]; openCollection: (technique: string) => void }) {
  const collections = filters.slice(1).map((technique) => {
    const works = artworks.filter((art) => art.status === 'published' && art.technique === technique)
    return { technique, works, cover: works[0]?.image ?? '', from: works.length ? Math.min(...works.map((art) => art.price)) : 0 }
  }).filter((collection) => collection.works.length)

  return <main className="browse-page"><p className="eyebrow">Por técnica</p><h1>Coleções</h1><p className="browse-intro">Explore as obras reunidas pela técnica usada em cada uma.</p>
    {collections.length ? <div className="browse-grid">{collections.map((collection) => <article className="browse-card" key={collection.technique}>
      <div className="browse-cover">{collection.cover ? <Image src={collection.cover} alt={`Coleção ${collection.technique}`} fill sizes="(max-width: 700px) 100vw, 33vw" /> : <span>{collection.technique.charAt(0)}</span>}</div>
      <div className="browse-body"><h2>{collection.technique}</h2><small>{collection.works.length} {collection.works.length === 1 ? 'obra' : 'obras'} · a partir de {currency(collection.from)}</small><Button kind="outline" onClick={() => openCollection(collection.technique)}>Ver coleção</Button></div>
    </article>)}</div> : <div className="account-empty"><span><Icon name="art" size={25} /></span><h3>Nenhuma coleção disponível</h3><p>Quando houver obras à venda, as coleções aparecem aqui.</p></div>}
  </main>
}

function DataError({ retry }: { retry: () => void }) {
  return <div className="account-empty"><h3>Não foi possível carregar os dados</h3><p>Verifique sua conexão e tente novamente.</p><Button kind="gold" onClick={retry}>Tentar novamente</Button></div>
}

function SalesPanel() {
  const [sales, setSales] = useState<SaleView[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      setSales(await listSales())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (failed) return <><h2>Minhas vendas</h2><DataError retry={() => void load()} /></>
  if (!sales) return <><h2>Minhas vendas</h2><p>Carregando…</p></>

  const paid = sales.filter((sale) => sale.status !== 'pending')
  const total = paid.reduce((sum, sale) => sum + sale.price, 0)
  if (!sales.length) return <><h2>Minhas vendas</h2><p>Acompanhe as obras que já foram compradas.</p><div className="account-empty"><span><Icon name="bag" size={25} /></span><h3>Nenhuma venda ainda</h3><p>Quando alguém comprar uma das suas obras, ela aparece aqui.</p></div></>

  return <><h2>Minhas vendas</h2><p>Acompanhe as obras que já foram compradas.</p>
    <div className="sales-summary"><div><span>Obras vendidas</span><strong>{paid.length}</strong></div><div><span>Total vendido</span><strong>{currency(total)}</strong></div><div><span>Aguardando pagamento</span><strong>{sales.length - paid.length}</strong></div></div>
    <div className="orders-list">{sales.map((sale, index) => <article className="order-card" key={`${sale.orderId}-${sale.artworkId}`}>
      <header><div><strong>Pedido {sale.orderNumber}</strong><span>{dateTime(sale.createdAt)}</span></div><em className={`order-status status-${sale.status}`}>{orderStatusLabel[sale.status]}</em></header>
      <div className="order-items"><div><div className="order-thumb"><Image src={sale.image} alt={sale.title} fill sizes="64px" /></div><p><strong>{sale.title}</strong><span>Comprador: {sale.buyerName}{sale.buyerCity ? ` · ${sale.buyerCity}${sale.buyerState ? `/${sale.buyerState}` : ''}` : ''}</span></p><b>{currency(sale.price)}</b></div></div>
      {sale.shipment && <ShipmentInfo shipment={sale.shipment} />}
      {sales.findIndex((other) => other.orderId === sale.orderId) === index && <ShipmentControls orderId={sale.orderId} canShip={sale.canShip} canDeliver={sale.canDeliver} address={sale.shippingAddress} recipient={sale.buyerName} done={() => void load()} />}
    </article>)}</div></>
}

function Cart({ items, close, remove, checkout }: { items: ArtworkView[]; close: () => void; remove: (id: string) => void; checkout: () => void }) {
  const total = items.reduce((sum, item) => sum + item.price, 0)
  return <div className="drawer-backdrop" onClick={close}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Sua seleção</p><h2>Carrinho <span>{items.length}</span></h2></div><button type="button" onClick={close}><Icon name="close" /></button></header><div className="cart-items">{items.length ? items.map((item) => <article key={item.id}><div><Image src={item.image} alt={item.title} fill sizes="100px" /></div><p><strong>{item.title}</strong><span>{item.artistName}</span><b>{currency(item.price)}</b></p><button type="button" onClick={() => remove(item.id)}>Remover</button></article>) : <div className="cart-empty"><Icon name="bag" size={32} /><h3>Seu carrinho está vazio</h3><p>Explore a galeria e encontre uma obra para chamar de sua.</p><Button kind="outline" onClick={close}>Explorar obras</Button></div>}</div>{items.length > 0 && <footer><div><span>Subtotal</span><strong>{currency(total)}</strong></div><p>Frete e prazo calculados na próxima etapa.</p><Button kind="gold" className="full" onClick={checkout}>Continuar compra</Button></footer>}</aside></div>
}

function Checkout({ items, close, finish, viewOrders, placeOrder, defaultAddress }: { items: ArtworkView[]; close: () => void; finish: () => void; viewOrders?: () => void; placeOrder: (input: { address: Address; paymentMethod: PaymentMethod }) => Promise<ActionResult>; defaultAddress?: Address }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [payment, setPayment] = useState<'pix' | 'boleto' | 'credit'>('pix')
  const [installments, setInstallments] = useState('1')
  const [processing, setProcessing] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [address, setAddress] = useState<Address>(() => ({ ...emptyAddress, ...defaultAddress }))
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvv: '' })
  const [orderNumber] = useState(() => `NG-${String(Date.now()).slice(-6)}`)
  const [placed, setPlaced] = useState<OrderView | null>(null)
  const [orderError, setOrderError] = useState('')
  const total = items.reduce((sum, item) => sum + item.price, 0)
  const installmentCount = Number(installments)
  const paymentLabel = payment === 'pix' ? 'Pix' : payment === 'boleto' ? 'Boleto' : 'Cartão de crédito'
  const paymentDetail = payment === 'pix' ? 'Confirmação imediata' : payment === 'boleto' ? 'Aprovação em 1 a 2 dias úteis' : `${installments}x de ${currency(total / installmentCount)}`

  async function submitOrder() {
    setProcessing(true)
    setOrderError('')
    const result = await placeOrder({ address, paymentMethod: payment })
    setProcessing(false)
    if (result.ok) {
      setPlaced(result.order ?? null)
      setStep(4)
    } else {
      setOrderError(result.message)
    }
  }

  function updateCard(field: keyof typeof card, value: string) {
    setCard((current) => ({ ...current, [field]: value }))
  }

  if (step === 4) {
    return <div className="checkout-overlay"><section className="checkout-success"><div className="success-burst" aria-hidden="true">{Array.from({ length: 12 }).map((_, index) => <span key={index} />)}</div><div className="success-check"><Icon name="check" size={42} /></div><p className="eyebrow">Pedido registrado</p><h2>Sua nova obra já faz parte da sua história.</h2><p>Pedido <strong>{placed?.number ?? orderNumber}</strong> registrado e aguardando pagamento. As obras ficam reservadas para você até o prazo do pedido.</p><p className="success-note">Ambiente de demonstração: nada é cobrado. Em “Meus pedidos” você acompanha o pedido e pode simular o pagamento.</p><div className="success-details"><span>Pagamento</span><strong>{payment === 'credit' ? `${paymentLabel} · ${installments}x` : paymentLabel}</strong><span>Total</span><strong>{currency(total)}</strong></div><div className="success-actions">{viewOrders && <Button kind="gold" onClick={viewOrders}>Ver meus pedidos</Button>}<Button kind={viewOrders ? 'outline' : 'gold'} onClick={finish}>Voltar para a galeria</Button></div></section></div>
  }

  return <div className="checkout-overlay"><section className="checkout-shell">
    <header className="checkout-header"><Logo /><div className="checkout-steps">{['Entrega', 'Pagamento', 'Revisão'].map((label, index) => { const number = index + 1; return <div key={label} className={step === number ? 'active' : step > number ? 'complete' : ''}><span>{step > number ? <Icon name="check" size={14} /> : number}</span><p>{label}</p></div> })}</div><button type="button" className="checkout-close" onClick={close} aria-label="Fechar checkout"><Icon name="close" /></button></header>
    <div className="checkout-body"><main className="checkout-content">
      {step === 1 && <form onSubmit={(event) => { event.preventDefault(); setStep(2) }}><div className="checkout-title"><p className="eyebrow">Etapa 01</p><h2>Onde sua obra será entregue?</h2><p>Preencha o endereço que será usado para calcular e acompanhar a entrega.</p></div><AddressFields value={address} onChange={setAddress} strict /><div className="checkout-actions"><Button kind="ghost" onClick={close}>Voltar ao carrinho</Button><Button type="submit" kind="gold">Continuar para pagamento <Icon name="arrow" size={16} /></Button></div></form>}
      {step === 2 && <form onSubmit={(event) => { event.preventDefault(); setStep(3) }}><div className="checkout-title"><p className="eyebrow">Etapa 02</p><h2>Escolha como pagar</h2><p>Esta é uma simulação visual. Nenhuma cobrança ou dado financeiro será processado.</p></div><div className="payment-group"><h3>Recomendados</h3><div className="payment-options"><button type="button" className={payment === 'pix' ? 'active' : ''} onClick={() => setPayment('pix')}><span className="payment-radio" /><span className="payment-icon pix"><Icon name="pix" size={27} /></span><div><strong>Pix</strong><small>Aprovação imediata</small></div></button><button type="button" className={payment === 'boleto' ? 'active' : ''} onClick={() => setPayment('boleto')}><span className="payment-radio" /><span className="payment-icon"><Icon name="barcode" size={27} /></span><div><strong>Boleto</strong><small>Aprovação em 1 a 2 dias úteis</small></div></button></div></div><div className="payment-group"><h3>Cartões</h3><div className="payment-options"><button type="button" className={payment === 'credit' ? 'active' : ''} onClick={() => setPayment('credit')}><span className="payment-radio" /><span className="payment-icon"><Icon name="card" size={27} /></span><div><strong>Cartão de crédito</strong><small>Parcele sua compra em até 12 vezes</small></div></button></div></div>{payment === 'pix' ? <div className="payment-info-panel"><span className="payment-icon pix"><Icon name="pix" size={28} /></span><div><h3>Pagamento rápido e seguro</h3><p>O QR Code seria gerado após a confirmação. Para este projeto, a etapa é apenas demonstrativa.</p></div></div> : payment === 'boleto' ? <div className="payment-info-panel"><span className="payment-icon"><Icon name="barcode" size={28} /></span><div><h3>Boleto bancário</h3><p>O código de barras seria gerado ao finalizar. A confirmação pode levar de 1 a 2 dias úteis.</p></div></div> : <div className="card-fields"><label className="field span-two"><span>Nome impresso no cartão</span><input required value={card.name} onChange={(event) => updateCard('name', event.target.value)} placeholder="Nome completo" /></label><label className="field span-two"><span>Número do cartão</span><input required inputMode="numeric" value={card.number} onChange={(event) => updateCard('number', event.target.value)} placeholder="0000 0000 0000 0000" /></label><label className="field"><span>Validade</span><input required value={card.expiry} onChange={(event) => updateCard('expiry', event.target.value)} placeholder="MM/AA" /></label><label className="field"><span>CVV</span><input required inputMode="numeric" maxLength={4} value={card.cvv} onChange={(event) => updateCard('cvv', event.target.value)} placeholder="123" /></label><label className="field span-two"><span>Parcelamento</span><select value={installments} onChange={(event) => setInstallments(event.target.value)}>{Array.from({ length: 12 }).map((_, index) => { const count = index + 1; return <option key={count} value={count}>{count}x de {currency(total / count)}{count === 1 ? ' à vista' : ''}</option> })}</select></label></div>}<div className="checkout-actions"><Button kind="ghost" onClick={() => setStep(1)}>Voltar</Button><Button type="submit" kind="gold">Revisar pedido <Icon name="arrow" size={16} /></Button></div></form>}
      {step === 3 && <div><div className="checkout-title"><p className="eyebrow">Etapa 03</p><h2>Revise antes de finalizar</h2><p>Confira os dados da entrega e a forma de pagamento escolhida.</p></div><div className="review-block"><div><span>Endereço de entrega</span><button type="button" onClick={() => setStep(1)}>Editar</button></div><p><strong>{address.street}, {address.number}</strong>{address.complement && ` · ${address.complement}`}<br />{address.neighborhood} · {address.city}/{address.state}<br />CEP {address.cep}</p></div><div className="review-block"><div><span>Forma de pagamento</span><button type="button" onClick={() => setStep(2)}>Editar</button></div><p><strong>{paymentLabel}</strong><br />{paymentDetail}</p></div><label className="checkout-terms"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Confirmo que revisei os dados e aceito os termos da compra demonstrativa.</span></label>{orderError && <p className="checkout-error" role="alert">{orderError}</p>}<div className="checkout-actions"><Button kind="ghost" onClick={() => setStep(2)}>Voltar</Button><Button kind="gold" disabled={processing || !accepted} onClick={submitOrder}>{processing ? 'Finalizando…' : 'Finalizar compra'} <Icon name="check" size={16} /></Button></div></div>}
    </main><aside className="checkout-summary"><p className="eyebrow">Resumo do pedido</p><h3>{items.length} {items.length === 1 ? 'obra selecionada' : 'obras selecionadas'}</h3><div className="summary-items">{items.map((item) => <article key={item.id}><div>{item.image && <Image src={item.image} alt={item.title} fill sizes="64px" />}</div><p><strong>{item.title}</strong><span>{item.artistName}</span><b>{currency(item.price)}</b></p></article>)}</div><dl><div><dt>Subtotal</dt><dd>{currency(total)}</dd></div><div><dt>Entrega</dt><dd>Grátis</dd></div>{step > 1 && <div><dt>Pagamento</dt><dd>{paymentLabel}</dd></div>}<div className="summary-total"><dt>Total</dt><dd>{currency(total)}</dd></div></dl><p className="secure-purchase"><Icon name="check" size={15} /> Ambiente de demonstração seguro</p></aside></div>
  </section></div>
}

function ArtModal({ art, close, add }: { art: ArtworkView; close: () => void; add: () => void }) {
  return <div className="modal-backdrop" onClick={close}><div className="art-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={close}><Icon name="close" /></button><div className="modal-image"><Image src={art.image} alt={art.title} fill sizes="60vw" /></div><div className="modal-copy"><p className="eyebrow">{art.technique} · {art.year}</p><h2>{art.title}</h2><span>por {art.artistName}</span><p>{art.description}</p>{art.width && art.height && <dl><div><dt>Dimensões</dt><dd>{art.width} × {art.height} cm</dd></div><div><dt>Autenticidade</dt><dd>Certificado incluso</dd></div></dl>}<strong>{currency(art.price)}</strong><Button kind="gold" className="full" onClick={add}>Adicionar ao carrinho</Button></div></div></div>
}

const artworkStatusLabel: Record<string, string> = { published: 'Publicada', draft: 'Rascunho', hidden: 'Despublicada', reserved: 'Reservada', sold: 'Vendida' }

function currency(value: number) {
  // Valores redondos aparecem sem centavos (R$ 880); os demais mostram os centavos (R$ 1.250,50).
  const digits = Number.isInteger(value) ? 0 : 2
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
