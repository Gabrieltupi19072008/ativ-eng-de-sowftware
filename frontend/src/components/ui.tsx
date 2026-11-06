import { useEffect, useState, type ReactNode } from 'react'

type ImageProps = { src: string; alt: string; fill?: boolean; priority?: boolean; sizes?: string }

export function Image({ src, alt, fill, priority, sizes }: ImageProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (failed) return <span className={`img-fallback${fill ? ' fill-img' : ''}`} role="img" aria-label={alt || 'Imagem indisponível'}><Icon name="art" size={28} /></span>
  return <img src={src} alt={alt} sizes={sizes} className={fill ? 'fill-img' : undefined} loading={priority ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
}

export function Icon({ name, size = 20 }: { name: 'arrow' | 'bag' | 'heart' | 'user' | 'upload' | 'check' | 'close' | 'plus' | 'logout' | 'art' | 'sun' | 'moon' | 'pix' | 'card' | 'barcode'; size?: number }) {
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

export function Logo({ light = false }: { light?: boolean }) {
  return <button type="button" className={`logo ${light ? 'logo-light' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>NAMBÁ GALERIE<span>.</span></button>
}

export function Button({ children, type = 'button', kind = 'dark', onClick, disabled, className = '' }: { children: ReactNode; type?: 'button' | 'submit'; kind?: 'dark' | 'gold' | 'outline' | 'ghost' | 'danger'; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${kind} ${className}`}>{children}</button>
}

export function Field({ label, name, type = 'text', placeholder, required, defaultValue, step, min }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean; defaultValue?: string; step?: string; min?: string }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue} step={step} min={min} /></label>
}

export function Toast({ message, error = false, onClose }: { message: string; error?: boolean; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 4500)
    return () => window.clearTimeout(id)
  }, [onClose])
  return <div className={`toast ${error ? 'toast-error' : ''}`}><Icon name={error ? 'close' : 'check'} size={17} /><span>{message}</span></div>
}

export function currency(value: number) {
  // Valores redondos aparecem sem centavos (R$ 880); os demais mostram os centavos (R$ 1.250,50).
  const digits = Number.isInteger(value) ? 0 : 2
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export function DataError({ retry }: { retry: () => void }) {
  return <div className="account-empty"><h3>Não foi possível carregar os dados</h3><p>Verifique sua conexão e tente novamente.</p><Button kind="gold" onClick={retry}>Tentar novamente</Button></div>
}
