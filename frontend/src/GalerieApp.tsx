import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { createArtworkAction, loginAction, logoutAction, registerAction, reviewArtistAction } from './api'

export type UserView = {
  id: string
  name: string
  email: string
  role: 'buyer' | 'artist' | 'admin'
  artistStatus?: 'not-applicable' | 'pending' | 'approved' | 'rejected' | null
  city: string
}

export type ArtworkView = {
  id: string
  title: string
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

type View = 'login' | 'register' | 'shop' | 'add-art' | 'account' | 'admin'
type RegisterRole = 'buyer' | 'artist'

const filters = ['Todos', 'Óleo', 'Aquarela', 'Acrílica', 'Pastel', 'Arte Digital', 'Técnica Mista']

type ImageProps = { src: string; alt: string; fill?: boolean; priority?: boolean; sizes?: string }
function Image({ src, alt, fill, priority, sizes }: ImageProps) {
  return <img src={src} alt={alt} sizes={sizes} className={fill ? 'fill-img' : undefined} loading={priority ? 'eager' : 'lazy'} />
}

function Icon({ name, size = 20 }: { name: 'arrow' | 'bag' | 'heart' | 'user' | 'upload' | 'check' | 'close' | 'plus' | 'logout' | 'art' | 'sun' | 'moon'; size?: number }) {
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
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function Logo({ light = false }: { light?: boolean }) {
  return <button type="button" className={`logo ${light ? 'logo-light' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>NAMBÁ GALERIE<span>.</span></button>
}

function Button({ children, type = 'button', kind = 'dark', onClick, disabled, className = '' }: { children: ReactNode; type?: 'button' | 'submit'; kind?: 'dark' | 'gold' | 'outline' | 'ghost' | 'danger'; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${kind} ${className}`}>{children}</button>
}

function Field({ label, name, type = 'text', placeholder, required, defaultValue }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean; defaultValue?: string }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue} /></label>
}

function Toast({ message, error = false, onClose }: { message: string; error?: boolean; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 4500)
    return () => window.clearTimeout(id)
  }, [onClose])
  return <div className={`toast ${error ? 'toast-error' : ''}`}><Icon name={error ? 'close' : 'check'} size={17} /><span>{message}</span></div>
}

export default function GalerieApp({ initialUser, initialArtworks, initialCandidates, onRefresh }: { initialUser: UserView | null; initialArtworks: ArtworkView[]; initialCandidates: ArtistCandidate[]; onRefresh: () => void }) {
  const [view, setView] = useState<View>(initialUser ? (initialUser.role === 'admin' ? 'admin' : 'shop') : 'login')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [registerRole, setRegisterRole] = useState<RegisterRole>('buyer')
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [favorites, setFavorites] = useState<string[]>([])
  const [cart, setCart] = useState<ArtworkView[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedArt, setSelectedArt] = useState<ArtworkView | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const artworks = initialArtworks
  const filtered = useMemo(() => artworks.filter((art) => art.status === 'published' && (activeFilter === 'Todos' || art.technique === activeFilter)), [artworks, activeFilter])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('galerie-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('galerie-theme', theme)
  }, [theme])

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

  function exitAccount() {
    startTransition(async () => {
      await logoutAction()
      window.location.reload()
    })
  }

  if (!initialUser && view === 'login') {
    return <Login
      submit={enterAccount}
      pending={isPending}
      error={message?.error ? message.text : null}
      createAccount={() => {
        setRegisterRole('buyer')
        navigate('register')
      }}
    />
  }

  if (!initialUser && view === 'register') {
    return <Register role={registerRole} setRole={setRegisterRole} back={() => navigate('login')} pending={isPending} submit={(data) => run(() => registerAction(data), () => navigate(registerRole === 'artist' ? 'account' : 'shop'))} />
  }

  const user = initialUser
  if (!user) {
    return <Login submit={enterAccount} pending={isPending} error={message?.error ? message.text : null} createAccount={() => navigate('register')} />
  }

  return <div className={`preview-theme theme-${theme}`}>
    {view === 'admin' ? (
      <Admin candidates={initialCandidates} artworks={artworks} user={user} theme={theme} toggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} back={() => navigate('shop')} review={(id, decision, note) => run(() => reviewArtistAction(id, decision, note))} pending={isPending} logout={exitAccount} />
    ) : (
      <div className="app-shell">
        <Header user={user} theme={theme} toggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} cartCount={cart.length} onCart={() => setCartOpen(true)} onAccount={() => navigate('account')} onShop={() => navigate('shop')} onAdd={() => navigate('add-art')} onAdmin={() => navigate('admin')} logout={exitAccount} />
        {view === 'shop' && <Shop user={user} artworks={filtered} total={artworks.length} filter={activeFilter} setFilter={setActiveFilter} favorite={favorites} toggleFavorite={(id) => setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])} addCart={(art) => { setCart((items) => items.some((item) => item.id === art.id) ? items : [...items, art]); setMessage({ text: `${art.title} foi adicionada ao carrinho.` }) }} select={setSelectedArt} onAdd={() => navigate('add-art')} />}
        {view === 'add-art' && <AddArtwork back={() => navigate('shop')} pending={isPending} submit={(data) => run(() => createArtworkAction(data), () => navigate('shop'))} />}
        {view === 'account' && <Account user={user} back={() => navigate('shop')} />}
      </div>
    )}
    {cartOpen && <Cart items={cart} close={() => setCartOpen(false)} remove={(id) => setCart((items) => items.filter((item) => item.id !== id))} />}
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

function Login({ submit, pending, error, createAccount }: {
  submit: (data: FormData) => void
  pending: boolean
  error: string | null
  createAccount: () => void
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
        <form action={submit} className="login-form reveal" style={step(1)}>
          <Field label="E-mail" name="email" type="email" placeholder="seu@email.com" required />
          <Field label="Senha" name="password" type="password" placeholder="Sua senha" required />
          {error && <p className="auth-error">{error}</p>}
          <Button type="submit" kind="gold" disabled={pending} className="full">{pending ? 'Entrando…' : 'Entrar'} <Icon name="arrow" /></Button>
        </form>
        <div className="auth-links reveal" style={step(2)}><button type="button" onClick={createAccount}>Criar conta</button><span /><button type="button" onClick={() => setNotice('A recuperação de senha será conectada na versão final.')}>Esqueci minha senha</button></div>
      </div>
    </section>
    {notice && <Toast message={notice} onClose={() => setNotice(null)} />}
  </main>
}

function Register({ role, setRole, back, pending, submit }: { role: RegisterRole; setRole: (role: RegisterRole) => void; back: () => void; pending: boolean; submit: (data: FormData) => void }) {
  const [previews, setPreviews] = useState<string[]>([])
  return <main className="register-page"><header><Logo /><button className="back-link" type="button" onClick={back}>← Voltar ao início</button></header><div className="register-wrap">
    <section className="register-copy"><p className="eyebrow">Nova conta</p><h1>{role === 'artist' ? 'Apresente sua arte ao mundo.' : 'Comece sua coleção.'}</h1><p>{role === 'artist' ? 'Envie seus dados e algumas obras. Nossa curadoria analisa seu perfil em até 48 horas.' : 'Preencha seus dados para descobrir obras de artistas independentes.'}</p><div className="role-switch"><button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => setRole('buyer')}>Comprador</button><button type="button" className={role === 'artist' ? 'active' : ''} onClick={() => setRole('artist')}>Artista</button></div></section>
    <form action={submit} className="register-form"><input type="hidden" name="role" value={role} /><div className="form-section"><h2>Dados pessoais</h2><div className="form-grid"><Field label="Nome completo" name="name" placeholder="Como devemos chamar você?" required /><Field label="E-mail" name="email" type="email" placeholder="voce@email.com" required /><Field label="Celular" name="phone" placeholder="(11) 99999-9999" /><Field label="CPF" name="cpf" placeholder="000.000.000-00" required /><Field label="Data de nascimento" name="birthDate" type="date" /><Field label="Senha" name="password" type="password" placeholder="Mínimo 8 caracteres" required /></div></div>
      <div className="form-section"><h2>Localização</h2><div className="form-grid location-grid"><Field label="CEP" name="cep" placeholder="00000-000" /><Field label="Cidade" name="city" placeholder="São Paulo" required /><Field label="UF" name="state" placeholder="SP" required /><Field label="Rua e número" name="address" placeholder="Seu endereço" /></div></div>
      {role === 'artist' && <div className="form-section artist-section"><div><h2>Perfil artístico</h2><p>Essas informações serão exibidas para a curadoria.</p></div><label className="field"><span>Técnica ou estilo principal</span><select name="artStyle" required><option value="">Selecione</option>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Sobre sua pesquisa artística</span><textarea name="artistBio" rows={5} required minLength={60} placeholder="Conte sobre sua trajetória, referências e processo criativo…" /></label><label className="portfolio-upload"><input type="file" name="portfolio" accept="image/*" multiple required onChange={(event) => setPreviews(Array.from(event.target.files ?? []).slice(0, 5).map(URL.createObjectURL))} /><Icon name="upload" /><strong>Anexe de 2 a 5 obras do seu portfólio</strong><span>JPG, PNG ou WEBP · até 10 MB por imagem</span></label>{previews.length > 0 && <div className="preview-strip">{previews.map((src, index) => <div key={src}><Image src={src} alt={`Prévia ${index + 1}`} fill sizes="120px" /></div>)}</div>}<div className="review-note"><span>48h</span><p><strong>Análise de curadoria</strong>Você poderá comprar normalmente enquanto seu perfil de vendedor é analisado.</p></div></div>}
      <label className="terms"><input type="checkbox" required /><span>Li e aceito os Termos de Uso e a Política de Privacidade.</span></label><Button type="submit" kind="gold" disabled={pending} className="full">{pending ? 'Enviando…' : role === 'artist' ? 'Enviar para análise' : 'Criar minha conta'}</Button>
    </form>
  </div></main>
}

function Header({ user, theme, toggleTheme, cartCount, onCart, onAccount, onShop, onAdd, onAdmin, logout }: { user: UserView; theme: 'light' | 'dark'; toggleTheme: () => void; cartCount: number; onCart: () => void; onAccount: () => void; onShop: () => void; onAdd: () => void; onAdmin: () => void; logout: () => void }) {
  const [menu, setMenu] = useState(false)
  return <header className="site-header"><Logo /><nav><button type="button" onClick={onShop}>Obras</button><button type="button" onClick={onShop}>Artistas</button><button type="button" onClick={onShop}>Coleções</button></nav><div className="header-actions">
    {user.role === 'artist' && user.artistStatus === 'approved' && <Button kind="gold" onClick={onAdd}><Icon name="plus" size={16} /> Adicionar arte</Button>}
    {user.role === 'admin' && <Button kind="outline" onClick={onAdmin}>Painel ADM</Button>}
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /><span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span></button>
    <button type="button" className="icon-button" onClick={onCart} aria-label="Abrir carrinho"><Icon name="bag" />{cartCount > 0 && <span>{cartCount}</span>}</button>
    <div className="user-menu"><button type="button" onClick={() => setMenu(!menu)} className="avatar">{user.name.charAt(0)}</button>{menu && <div className="menu-popover"><p><strong>{user.name}</strong><span>{user.role === 'buyer' ? 'Comprador' : user.role === 'artist' ? 'Artista' : 'Administrador'}</span></p><button type="button" onClick={() => { setMenu(false); onAccount() }}><Icon name="user" size={17} /> Minha conta</button><button type="button" onClick={logout}><Icon name="logout" size={17} /> Sair</button></div>}</div>
  </div></header>
}

function Shop({ user, artworks, total, filter, setFilter, favorite, toggleFavorite, addCart, select, onAdd }: { user: UserView; artworks: ArtworkView[]; total: number; filter: string; setFilter: (filter: string) => void; favorite: string[]; toggleFavorite: (id: string) => void; addCart: (art: ArtworkView) => void; select: (art: ArtworkView) => void; onAdd: () => void }) {
  return <main><section className="shop-hero"><Image src="https://images.unsplash.com/photo-1618331833071-ce81bd50d300?auto=format&fit=crop&w=1800&q=90" alt="Pintura abstrata azul, branca e amarela" fill priority sizes="100vw" /><div className="hero-overlay" /><div className="hero-copy"><p className="eyebrow">Curadoria de setembro</p><h1>Arte que transforma<br />o jeito de <em>habitar.</em></h1><p>Obras originais, histórias singulares e artistas de todo o Brasil.</p><Button kind="gold" onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}>Explorar curadoria</Button></div></section>
    {user.role === 'artist' && <section className={`artist-status status-${user.artistStatus}`}><div><span className="status-dot" /><p><strong>{user.artistStatus === 'approved' ? `Bem-vindo ao seu ateliê, ${user.name.split(' ')[0]}` : 'Seu perfil está em análise'}</strong>{user.artistStatus === 'approved' ? 'Sua vitrine está ativa e pronta para receber novas obras.' : 'Nossa curadoria responderá em até 48 horas. Enquanto isso, explore a loja.'}</p></div>{user.artistStatus === 'approved' && <Button kind="outline" onClick={onAdd}>Publicar nova obra</Button>}</section>}
    <section className="catalog" id="catalogo"><div className="catalog-top"><div><p className="eyebrow">Descubra sua próxima obra</p><h2>Galeria em destaque</h2></div><p>{artworks.length} de {total || artworks.length} obras</p></div><div className="filters">{filters.map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
      {artworks.length ? <div className="art-grid">{artworks.map((art, index) => <article className={`art-card ${index === 0 ? 'featured-card' : ''}`} key={art.id}><button type="button" className="art-image" onClick={() => select(art)}><Image src={art.image} alt={art.title} fill sizes="(max-width: 700px) 50vw, 25vw" /><span>Ver detalhes</span></button><button type="button" className={`favorite ${favorite.includes(art.id) ? 'active' : ''}`} onClick={() => toggleFavorite(art.id)} aria-label="Favoritar obra"><Icon name="heart" size={18} /></button><div className="art-meta"><div><p>{art.artistName}</p><h3>{art.title}</h3><span>{art.technique}{art.width && art.height ? ` · ${art.width} × ${art.height} cm` : ''}</span></div><div><strong>{currency(art.price)}</strong><button type="button" onClick={() => addCart(art)} aria-label="Adicionar ao carrinho"><Icon name="plus" size={16} /></button></div></div></article>)}</div> : <div className="empty-state"><Icon name="art" size={40} /><h3>Nenhuma obra nesta técnica</h3><p>Experimente outro filtro para continuar explorando.</p><Button kind="outline" onClick={() => setFilter('Todos')}>Ver todas</Button></div>}
    </section>
  </main>
}

function AddArtwork({ back, pending, submit }: { back: () => void; pending: boolean; submit: (data: FormData) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [submitType, setSubmitType] = useState('published')
  return <main className="editor-page"><button type="button" className="back-link" onClick={back}>← Voltar para a loja</button><div className="editor-heading"><div><p className="eyebrow">Nova publicação</p><h1>Conte a história da sua obra.</h1></div><p>Boas imagens e uma descrição cuidadosa ajudam colecionadores a se conectarem com seu trabalho.</p></div>
    <form action={submit} className="art-editor"><input type="hidden" name="submitType" value={submitType} /><section className="upload-panel"><div className="section-number">01</div><div className="panel-title"><h2>Imagens da obra</h2><p>Adicione até 5 fotos. A primeira será usada como capa.</p></div><button type="button" className={`art-dropzone ${previews.length ? 'has-preview' : ''}`} onClick={() => fileRef.current?.click()}>{previews.length ? <Image src={previews[0]} alt="Prévia principal da obra" fill sizes="50vw" /> : <><span><Icon name="upload" size={26} /></span><strong>Selecione ou arraste imagens</strong><small>JPG, PNG ou WEBP · máximo 10 MB</small></>}</button><input ref={fileRef} className="sr-only" type="file" name="images" accept="image/*" multiple required onChange={(event) => setPreviews(Array.from(event.target.files ?? []).slice(0, 5).map(URL.createObjectURL))} />{previews.length > 0 && <div className="thumb-row">{previews.map((src, index) => <button type="button" key={src} onClick={() => fileRef.current?.click()}><Image src={src} alt={`Imagem ${index + 1}`} fill sizes="100px" />{index === 0 && <span>Capa</span>}</button>)}{previews.length < 5 && <button type="button" className="add-thumb" onClick={() => fileRef.current?.click()}><Icon name="plus" /></button>}</div>}<div className="photo-tips"><strong>Para uma boa apresentação</strong><ul><li>Use luz natural e fundo neutro</li><li>Fotografe a obra de frente</li><li>Inclua um detalhe da textura</li></ul></div></section>
      <section className="details-panel"><div className="section-number">02</div><div className="panel-title"><h2>Detalhes da obra</h2><p>Informações que ajudam a contextualizar e vender seu trabalho.</p></div><div className="form-stack"><Field label="Título da obra" name="title" placeholder="Ex.: Entardecer no Cerrado" required /><label className="field"><span>Técnica</span><select name="technique" required><option value="">Selecione uma técnica</option>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><div className="form-grid three"><Field label="Largura (cm)" name="width" type="number" placeholder="60" required /><Field label="Altura (cm)" name="height" type="number" placeholder="80" required /><Field label="Ano" name="year" type="number" defaultValue={String(new Date().getFullYear())} required /></div><label className="field"><span>História e processo criativo</span><textarea name="description" rows={6} placeholder="Conte sobre as inspirações, materiais e o processo por trás desta obra…" required /></label><Field label="Valor de venda (R$)" name="price" type="number" placeholder="1200" required /></div><div className="editor-actions"><Button type="submit" kind="outline" disabled={pending} onClick={() => setSubmitType('draft')}>Salvar rascunho</Button><Button type="submit" kind="gold" disabled={pending} onClick={() => setSubmitType('published')}>{pending ? 'Publicando…' : 'Publicar obra'}</Button></div></section>
    </form>
  </main>
}

function Admin({ candidates: initial, artworks, user, theme, toggleTheme, back, review, pending, logout }: { candidates: ArtistCandidate[]; artworks: ArtworkView[]; user: UserView; theme: 'light' | 'dark'; toggleTheme: () => void; back: () => void; review: (id: string, decision: 'approved' | 'rejected', note: string) => void; pending: boolean; logout: () => void }) {
  const [tab, setTab] = useState<'approvals' | 'artists' | 'artworks' | 'reports'>('approvals')
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
  const headings = {
    approvals: ['Curadoria de artistas', 'Analise novas solicitações e seus portfólios.'],
    artists: ['Todos os artistas', 'Acompanhe os artistas ativos na Nambá Galerie.'],
    artworks: ['Gestão de obras', 'Visualize o catálogo publicado na plataforma.'],
    reports: ['Relatórios e estatísticas', 'Acompanhe os principais números da Nambá Galerie.'],
  }
  const catalogValue = artworks.reduce((total, artwork) => total + artwork.price, 0)
  const averagePrice = artworks.length ? catalogValue / artworks.length : 0
  const techniques = Array.from(new Set(artworks.map((artwork) => artwork.technique))).map((technique) => ({
    technique,
    count: artworks.filter((artwork) => artwork.technique === technique).length,
  })).sort((a, b) => b.count - a.count)

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
  return <main className="admin-page"><aside className="admin-sidebar"><Logo light /><div className="admin-user"><span>{user.name.charAt(0)}</span><p><strong>{user.name}</strong><small>Curadoria Nambá</small></p></div><nav><button className={tab === 'approvals' ? 'active' : ''} type="button" onClick={() => setTab('approvals')}><span>01</span>Aprovações <b>{candidates.length}</b></button><button className={tab === 'artists' ? 'active' : ''} type="button" onClick={() => setTab('artists')}><span>02</span>Artistas</button><button className={tab === 'artworks' ? 'active' : ''} type="button" onClick={() => setTab('artworks')}><span>03</span>Obras</button><button className={tab === 'reports' ? 'active' : ''} type="button" onClick={() => setTab('reports')}><span>04</span>Relatórios</button></nav><button type="button" className="admin-theme-toggle" onClick={toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /> Modo {theme === 'dark' ? 'claro' : 'escuro'}</button><button type="button" className="sidebar-exit" onClick={logout}><Icon name="logout" size={18} /> Sair</button></aside>
    <section className="admin-main"><header><div><p className="eyebrow">Painel administrativo</p><h1>{headings[tab][0]}</h1><p className="admin-subtitle">{headings[tab][1]}</p></div><Button kind="outline" onClick={back}>Visualizar loja</Button></header><div className="admin-stats"><article><span>Pendentes</span><strong>{candidates.length}</strong><small>aguardando análise</small></article><article><span>Aprovados</span><strong>{artists.length}</strong><small>artistas ativos</small></article><article><span>Obras</span><strong>{artworks.length}</strong><small>no catálogo</small></article></div>
      {tab === 'approvals' && <div className="review-layout"><section className="candidate-list"><div className="list-heading"><h2>Novas solicitações</h2><span>{candidates.length}</span></div>{candidates.length ? candidates.map((candidate) => <button type="button" key={candidate.id} className={selected?.id === candidate.id ? 'active' : ''} onClick={() => setSelected(candidate)}><span className="candidate-avatar">{candidate.name.charAt(0)}</span><div><strong>{candidate.name}</strong><small>{candidate.artStyle}</small><em>{candidate.city}{candidate.state ? ` · ${candidate.state}` : ''}</em></div><Icon name="arrow" size={17} /></button>) : <div className="list-empty"><Icon name="check" /><p>Fila concluída</p><small>Não há artistas aguardando análise.</small></div>}</section>
        <section className="candidate-detail">{selected ? <><div className="candidate-heading"><div><span className="candidate-avatar large">{selected.name.charAt(0)}</span><div><p className="eyebrow">Candidatura de artista</p><h2>{selected.name}</h2><span>{selected.email} · {selected.city}{selected.state ? `, ${selected.state}` : ''}</span></div></div><small>Enviado em {new Date(selected.createdAt).toLocaleDateString('pt-BR')}</small></div><div className="candidate-bio"><span>Pesquisa artística</span><h3>{selected.artStyle}</h3><p>{selected.artistBio || 'O artista ainda não adicionou uma descrição detalhada.'}</p></div><div className="portfolio-heading"><div><span>Portfólio enviado</span><strong>{selected.portfolio.length} obras</strong></div><p>Clique em uma imagem para ampliar e observar os detalhes.</p></div>{selected.portfolio.length ? <div className="portfolio-grid">{selected.portfolio.map((src, index) => <button type="button" key={src} onClick={() => setLightbox(src)}><Image src={src} alt={`Obra ${index + 1} do portfólio de ${selected.name}`} fill sizes="25vw" /><span>Ampliar</span></button>)}</div> : <div className="portfolio-empty">Nenhuma imagem de portfólio foi anexada.</div>}<label className="field review-field"><span>Observação para o artista (opcional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Explique sua decisão ou solicite ajustes…" /></label><div className="review-actions"><Button kind="danger" disabled={pending} onClick={() => decide('rejected')}><Icon name="close" size={17} /> Rejeitar</Button><Button kind="gold" disabled={pending} onClick={() => decide('approved')}><Icon name="check" size={17} /> Aprovar artista</Button></div></> : <div className="review-complete"><span><Icon name="check" size={32} /></span><h2>Curadoria em dia</h2><p>Todos os cadastros foram analisados.</p></div>}</section>
      </div>}
      {tab === 'artists' && <section className="admin-panel"><div className="panel-heading"><div><h2>Artistas ativos</h2><p>{artists.length} perfis disponíveis na plataforma</p></div><label className="admin-search"><span>Buscar</span><input placeholder="Nome ou técnica" /></label></div><div className="artist-admin-grid">{artists.map((artist) => <article key={artist.id}><span className="candidate-avatar large">{artist.name.charAt(0)}</span><div><h3>{artist.name}</h3><p>{artist.style}</p><small>{artist.location}</small></div><dl><div><dt>Obras</dt><dd>{artist.artworks}</dd></div><div><dt>Status</dt><dd className="status-active">Ativo</dd></div></dl><Button kind="outline">Ver perfil</Button></article>)}</div></section>}
      {tab === 'artworks' && <section className="admin-panel"><div className="panel-heading"><div><h2>Catálogo de obras</h2><p>{artworks.length} obras cadastradas</p></div><Button kind="outline">Exportar lista</Button></div><div className="artwork-admin-table"><div className="table-head"><span>Obra</span><span>Artista</span><span>Técnica</span><span>Valor</span><span>Status</span></div>{artworks.map((artwork) => <article key={artwork.id}><div className="admin-artwork-title"><div>{artwork.image && <Image src={artwork.image} alt="" fill sizes="54px" />}</div><strong>{artwork.title}</strong></div><span>{artwork.artistName}</span><span>{artwork.technique}</span><strong>{currency(artwork.price)}</strong><em>{artwork.status === 'published' ? 'Publicada' : 'Rascunho'}</em></article>)}</div></section>}
      {tab === 'reports' && <section className="reports-layout"><div className="report-cards"><article><span>Valor do catálogo</span><strong>{currency(catalogValue)}</strong><small>soma das obras publicadas</small></article><article><span>Preço médio</span><strong>{currency(averagePrice)}</strong><small>por obra cadastrada</small></article><article><span>Média por artista</span><strong>{artists.length ? (artworks.length / artists.length).toFixed(1) : '0'}</strong><small>obras por artista</small></article></div><div className="reports-grid"><section><div className="panel-heading"><div><h2>Obras por técnica</h2><p>Distribuição do catálogo atual</p></div></div><div className="technique-report">{techniques.map((item) => <div key={item.technique}><p><span>{item.technique}</span><strong>{item.count}</strong></p><meter min="0" max={Math.max(...techniques.map((entry) => entry.count), 1)} value={item.count} /></div>)}</div></section><section><div className="panel-heading"><div><h2>Resumo da curadoria</h2><p>Situação dos perfis analisados</p></div></div><div className="curation-summary"><div><span className="summary-dot pending" /><p><strong>{candidates.length}</strong>Pendentes</p></div><div><span className="summary-dot approved" /><p><strong>{artists.length}</strong>Aprovados</p></div><div><span className="summary-dot catalogued" /><p><strong>{artworks.length}</strong>Obras ativas</p></div></div></section></div></section>}
    </section>{lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><button type="button" aria-label="Fechar"><Icon name="close" /></button><div><Image src={lightbox} alt="Obra ampliada do portfólio" fill sizes="90vw" /></div></div>}</main>
}

function Account({ user, back }: { user: UserView; back: () => void }) {
  const [tab, setTab] = useState<'personal' | 'addresses' | 'orders' | 'security'>('personal')
  const tabs = [
    { id: 'personal' as const, label: 'Dados pessoais' },
    { id: 'addresses' as const, label: 'Endereços' },
    { id: 'orders' as const, label: 'Pedidos' },
    { id: 'security' as const, label: 'Segurança' },
  ]

  return <main className="account-page"><button type="button" className="back-link" onClick={back}>← Voltar para a loja</button><div className="account-header"><span>{user.name.charAt(0)}</span><div><p className="eyebrow">Minha conta</p><h1>{user.name}</h1><p>{user.role === 'buyer' ? 'Perfil de comprador' : user.role === 'artist' ? 'Perfil de artista' : 'Perfil administrativo'}{user.city ? ` · ${user.city}` : ''}</p></div></div><div className="account-grid"><aside>{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} type="button" onClick={() => setTab(item.id)}>{item.label}</button>)}</aside>
    <section>
      {tab === 'personal' && <><h2>Dados pessoais</h2><p>Visualize as principais informações do seu perfil.</p><div className="form-grid"><Field label="Nome completo" name="name" defaultValue={user.name} /><Field label="Cidade" name="city" defaultValue={user.city} /><Field label="Perfil" name="role" defaultValue={user.role === 'buyer' ? 'Comprador' : user.role === 'artist' ? 'Artista' : 'Administrador'} /><Field label="Status" name="status" defaultValue="Demonstração ativa" /></div><Button kind="gold">Salvar alterações</Button></>}
      {tab === 'addresses' && <><div className="account-section-heading"><div><h2>Endereços</h2><p>Gerencie os locais usados para entrega das suas obras.</p></div><Button kind="outline">Adicionar endereço</Button></div><div className="account-empty"><span><Icon name="user" size={25} /></span><h3>Nenhum endereço cadastrado</h3><p>Quando você adicionar um endereço, ele aparecerá aqui para facilitar suas próximas compras.</p><Button kind="gold">Cadastrar primeiro endereço</Button></div></>}
      {tab === 'orders' && <><h2>Meus pedidos</h2><p>Acompanhe suas compras e consulte pedidos anteriores.</p><div className="account-empty"><span><Icon name="bag" size={25} /></span><h3>Você ainda não fez nenhum pedido</h3><p>As obras compradas e o andamento das entregas aparecerão nesta área.</p><Button kind="gold" onClick={back}>Explorar obras</Button></div></>}
      {tab === 'security' && <><h2>Segurança</h2><p>Opções para proteger o acesso à sua conta.</p><div className="security-list"><article><div><strong>Senha de acesso</strong><span>Nenhuma senha configurada no modo de demonstração.</span></div><Button kind="outline">Configurar senha</Button></article><article><div><strong>Verificação em duas etapas</strong><span>Adicione uma camada extra de proteção ao seu perfil.</span></div><button type="button" className="status-control">Desativada</button></article><article><div><strong>Sessões conectadas</strong><span>Este é o único acesso de demonstração ativo.</span></div><Button kind="outline">Ver sessões</Button></article></div><div className="security-note"><Icon name="check" size={18} /><p><strong>Ambiente de demonstração</strong>Nenhuma alteração de segurança será salva neste momento.</p></div></>}
    </section>
  </div></main>
}

function Cart({ items, close, remove }: { items: ArtworkView[]; close: () => void; remove: (id: string) => void }) {
  const total = items.reduce((sum, item) => sum + item.price, 0)
  return <div className="drawer-backdrop" onClick={close}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Sua seleção</p><h2>Carrinho <span>{items.length}</span></h2></div><button type="button" onClick={close}><Icon name="close" /></button></header><div className="cart-items">{items.length ? items.map((item) => <article key={item.id}><div><Image src={item.image} alt={item.title} fill sizes="100px" /></div><p><strong>{item.title}</strong><span>{item.artistName}</span><b>{currency(item.price)}</b></p><button type="button" onClick={() => remove(item.id)}>Remover</button></article>) : <div className="cart-empty"><Icon name="bag" size={32} /><h3>Seu carrinho está vazio</h3><p>Explore a galeria e encontre uma obra para chamar de sua.</p><Button kind="outline" onClick={close}>Explorar obras</Button></div>}</div>{items.length > 0 && <footer><div><span>Subtotal</span><strong>{currency(total)}</strong></div><p>Frete e prazo calculados na próxima etapa.</p><Button kind="gold" className="full">Continuar compra</Button></footer>}</aside></div>
}

function ArtModal({ art, close, add }: { art: ArtworkView; close: () => void; add: () => void }) {
  return <div className="modal-backdrop" onClick={close}><div className="art-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={close}><Icon name="close" /></button><div className="modal-image"><Image src={art.image} alt={art.title} fill sizes="60vw" /></div><div className="modal-copy"><p className="eyebrow">{art.technique} · {art.year}</p><h2>{art.title}</h2><span>por {art.artistName}</span><p>{art.description}</p>{art.width && art.height && <dl><div><dt>Dimensões</dt><dd>{art.width} × {art.height} cm</dd></div><div><dt>Autenticidade</dt><dd>Certificado incluso</dd></div></dl>}<strong>{currency(art.price)}</strong><Button kind="gold" className="full" onClick={add}>Adicionar ao carrinho</Button></div></div></div>
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}
