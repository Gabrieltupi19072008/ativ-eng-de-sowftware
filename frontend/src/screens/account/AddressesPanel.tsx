import { useCallback, useEffect, useState } from 'react'
import { deleteAddressAction, listAddresses, saveAddressAction } from '../../api'
import { emptyAddress, type Address, type SavedAddress } from '../../types'
import { AddressFields } from '../../components/AddressFields'
import { Icon, Button, DataError } from '../../components/ui'

export function AddressesPanel({ onChange }: { onChange?: () => void }) {
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
