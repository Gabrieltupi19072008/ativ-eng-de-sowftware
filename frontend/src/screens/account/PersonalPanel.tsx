import { useState } from 'react'
import { updateProfileAction } from '../../api'
import type { UserView } from '../../types'
import { Button, Field } from '../../components/ui'

export function PersonalPanel({ user, onSaved }: { user: UserView; onSaved?: () => void }) {
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
