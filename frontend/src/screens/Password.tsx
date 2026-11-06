import { useState } from 'react'
import { forgotPasswordAction, resetPasswordAction } from '../api'
import { Logo, Button } from '../components/ui'

export function ForgotPassword({ back }: { back: () => void }) {
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

export function ResetPassword({ token, done }: { token: string; done: () => void }) {
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
