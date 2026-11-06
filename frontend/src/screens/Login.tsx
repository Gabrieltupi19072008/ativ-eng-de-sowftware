import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Image, Icon, Logo, Button, Field, Toast } from '../components/ui'

// Acesso rápido (contas de teste) só em desenvolvimento. No site publicado fica escondido, a menos que VITE_DEMO_ACCESS=true.
const SHOW_QUICK_ACCESS = import.meta.env.DEV || import.meta.env.VITE_DEMO_ACCESS === 'true'

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

export function Login({ submit, quickAccess, pending, error, createAccount, forgot }: {
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
        {SHOW_QUICK_ACCESS && <div className="quick-access reveal" style={step(3)}><span>Acesso rápido para visualizar</span><div><button type="button" disabled={pending} onClick={() => quickAccess('buyer')}>Comprador</button><button type="button" disabled={pending} onClick={() => quickAccess('artist')}>Artista / Vendedor</button><button type="button" disabled={pending} onClick={() => quickAccess('admin')}>Administrador</button></div></div>}
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
