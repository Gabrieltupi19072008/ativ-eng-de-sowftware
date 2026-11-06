import { useEffect, useMemo, useState, useTransition } from 'react'
import { listFavorites, setFavoriteAction, createArtworkAction, createOrderAction, demoLoginAction, loginAction, logoutAction, registerAction, reviewArtistAction, type ActionResult } from './api'
import type { Address, UserView, ArtworkView, PaymentMethod, ArtistCandidate } from './types'
import { Toast } from './components/ui'
import { Account } from './screens/Account'
import { AddArtwork } from './screens/AddArtwork'
import { Admin } from './screens/Admin'
import { ArtistsPage, CollectionsPage } from './screens/Browse'
import { Cart, Checkout } from './screens/Checkout'
import { Login } from './screens/Login'
import { ForgotPassword, ResetPassword } from './screens/Password'
import { Register, type RegisterRole } from './screens/Register'
import { Header, Shop, ArtModal } from './screens/Shop'

type View = 'login' | 'register' | 'forgot' | 'reset' | 'shop' | 'artists' | 'collections' | 'add-art' | 'account' | 'admin'

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
