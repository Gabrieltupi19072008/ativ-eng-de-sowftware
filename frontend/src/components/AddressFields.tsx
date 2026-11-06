import { useCallback, useRef, useState } from 'react'
import { lookupCep, type CepAddress } from '../api'
import type { Address } from '../types'

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
export function AddressFields({ value, onChange, strict }: { value: Address; onChange: (address: Address) => void; strict: boolean }) {
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
