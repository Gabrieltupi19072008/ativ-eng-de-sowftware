import { useRef, useState } from 'react'
import { deleteArtworkAction, updateArtworkAction, type ActionResult } from '../../api'
import type { ArtworkView } from '../../types'
import { artworkStatusLabel } from '../../components/labels'
import { Image, Icon, Button, Field, currency } from '../../components/ui'
import { filters } from '../Shop'

export function MyArtworks({ artworks, onChange }: { artworks: ArtworkView[]; onChange?: () => void }) {
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
