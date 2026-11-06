import { useState } from 'react'
import { changePasswordAction } from '../../api'
import { Button } from '../../components/ui'

export function SecurityPanel() {
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
