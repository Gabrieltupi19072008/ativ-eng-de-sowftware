import { useEffect, useState } from 'react'
import { listAddresses, simulatePaymentAction, type ActionResult } from '../api'
import { emptyAddress, type Address, type SavedAddress, type ArtworkView, type PaymentMethod, type OrderView } from '../types'
import { AddressFields } from '../components/AddressFields'
import { Image, Icon, Logo, Button, currency } from '../components/ui'

export function Cart({ items, close, remove, checkout }: { items: ArtworkView[]; close: () => void; remove: (id: string) => void; checkout: () => void }) {
  const total = items.reduce((sum, item) => sum + item.price, 0)
  return <div className="drawer-backdrop" onClick={close}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Sua seleção</p><h2>Carrinho <span>{items.length}</span></h2></div><button type="button" onClick={close}><Icon name="close" /></button></header><div className="cart-items">{items.length ? items.map((item) => <article key={item.id}><div><Image src={item.image} alt={item.title} fill sizes="100px" /></div><p><strong>{item.title}</strong><span>{item.artistName}</span><b>{currency(item.price)}</b></p><button type="button" onClick={() => remove(item.id)}>Remover</button></article>) : <div className="cart-empty"><Icon name="bag" size={32} /><h3>Seu carrinho está vazio</h3><p>Explore a galeria e encontre uma obra para chamar de sua.</p><Button kind="outline" onClick={close}>Explorar obras</Button></div>}</div>{items.length > 0 && <footer><div><span>Subtotal</span><strong>{currency(total)}</strong></div><p>Frete e prazo calculados na próxima etapa.</p><Button kind="gold" className="full" onClick={checkout}>Continuar compra</Button></footer>}</aside></div>
}

export function Checkout({ items, close, finish, viewOrders, placeOrder, defaultAddress }: { items: ArtworkView[]; close: () => void; finish: () => void; viewOrders?: () => void; placeOrder: (input: { address: Address; paymentMethod: PaymentMethod }) => Promise<ActionResult>; defaultAddress?: Address }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [payment, setPayment] = useState<'pix' | 'boleto' | 'credit'>('pix')
  const [installments, setInstallments] = useState('1')
  const [processing, setProcessing] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [address, setAddress] = useState<Address>(() => ({ ...emptyAddress, ...defaultAddress }))
  const [saved, setSaved] = useState<SavedAddress[]>([])
  const [choice, setChoice] = useState<string>('new') // id do endereço salvo escolhido, ou 'new' para digitar outro
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvv: '' })
  const [orderNumber] = useState(() => `NG-${String(Date.now()).slice(-6)}`)
  const [placed, setPlaced] = useState<OrderView | null>(null)
  const [orderError, setOrderError] = useState('')
  const total = items.reduce((sum, item) => sum + item.price, 0)
  const installmentCount = Number(installments)
  const paymentLabel = payment === 'pix' ? 'Pix' : payment === 'boleto' ? 'Boleto' : 'Cartão de crédito'
  const paymentDetail = payment === 'pix' ? 'Confirmação imediata' : payment === 'boleto' ? 'Aprovação em 1 a 2 dias úteis' : `${installments}x de ${currency(total / installmentCount)}`

  useEffect(() => {
    let alive = true
    listAddresses().then((list) => {
      if (!alive || !list.length) return
      setSaved(list)
      pickSaved(list[0]) // o primeiro endereço salvo já vem escolhido
    }).catch(() => {}) // sem endereços salvos (ou prévia sem login), o formulário continua valendo
    return () => { alive = false }
  }, [])

  function pickSaved(item: SavedAddress) {
    const { id, ...fields } = item
    setAddress({ ...emptyAddress, ...fields })
    setChoice(id)
  }

  function pickNew() {
    setAddress(emptyAddress)
    setChoice('new')
  }

  async function submitOrder() {
    setProcessing(true)
    setOrderError('')
    const result = await placeOrder({ address, paymentMethod: payment })
    let order = result.ok ? result.order ?? null : null
    if (order?.canSimulatePayment) { // demonstração: nada é cobrado, o pedido já nasce pago
      const paid = await simulatePaymentAction(order.id)
      if (paid.ok && paid.order) order = paid.order
    }
    setProcessing(false)
    if (result.ok) {
      setPlaced(order)
      setStep(4)
    } else {
      setOrderError(result.message)
    }
  }

  function updateCard(field: keyof typeof card, value: string) {
    setCard((current) => ({ ...current, [field]: value }))
  }

  if (step === 4) {
    return <div className="checkout-overlay"><section className="checkout-success"><div className="success-burst" aria-hidden="true">{Array.from({ length: 12 }).map((_, index) => <span key={index} />)}</div><div className="success-check"><Icon name="check" size={42} /></div><p className="eyebrow">{placed?.status === 'paid' ? 'Pagamento confirmado' : 'Pedido registrado'}</p><h2>Sua nova obra já faz parte da sua história.</h2>{placed?.status === 'paid' ? <p>Pedido <strong>{placed.number}</strong> pago. Em “Meus pedidos” você acompanha o envio.</p> : <p>Pedido <strong>{placed?.number ?? orderNumber}</strong> registrado e aguardando pagamento. As obras ficam reservadas para você até o prazo do pedido.</p>}<p className="success-note">Ambiente de demonstração: nenhuma cobrança real foi feita e os dados do cartão não saem do seu navegador.</p><div className="success-details"><span>Pagamento</span><strong>{payment === 'credit' ? `${paymentLabel} · ${installments}x` : paymentLabel}</strong><span>Total</span><strong>{currency(total)}</strong></div><div className="success-actions">{viewOrders && <Button kind="gold" onClick={viewOrders}>Ver meus pedidos</Button>}<Button kind={viewOrders ? 'outline' : 'gold'} onClick={finish}>Voltar para a galeria</Button></div></section></div>
  }

  return <div className="checkout-overlay"><section className="checkout-shell">
    <header className="checkout-header"><Logo /><div className="checkout-steps">{['Entrega', 'Pagamento', 'Revisão'].map((label, index) => { const number = index + 1; return <div key={label} className={step === number ? 'active' : step > number ? 'complete' : ''}><span>{step > number ? <Icon name="check" size={14} /> : number}</span><p>{label}</p></div> })}</div><button type="button" className="checkout-close" onClick={close} aria-label="Fechar checkout"><Icon name="close" /></button></header>
    <div className="checkout-body"><main className="checkout-content">
      {step === 1 && <form onSubmit={(event) => { event.preventDefault(); setStep(2) }}><div className="checkout-title"><p className="eyebrow">Etapa 01</p><h2>Onde sua obra será entregue?</h2><p>Preencha o endereço que será usado para calcular e acompanhar a entrega.</p></div>{saved.length > 0 && <div className="payment-options saved-addresses" role="radiogroup" aria-label="Endereços salvos">{saved.map((item) => <button type="button" role="radio" aria-checked={choice === item.id} key={item.id} className={choice === item.id ? 'active' : ''} onClick={() => pickSaved(item)}><span className="payment-radio" /><div><strong>{item.street}, {item.number}{item.complement && ` · ${item.complement}`}</strong><small>{item.neighborhood} · {item.city}/{item.state} · CEP {item.cep}</small></div></button>)}<button type="button" role="radio" aria-checked={choice === 'new'} className={choice === 'new' ? 'active' : ''} onClick={pickNew}><span className="payment-radio" /><div><strong>Usar outro endereço</strong><small>Preencha os dados de entrega abaixo</small></div></button></div>}{(saved.length === 0 || choice === 'new') && <AddressFields value={address} onChange={setAddress} strict />}<div className="checkout-actions"><Button kind="ghost" onClick={close}>Voltar ao carrinho</Button><Button type="submit" kind="gold">Continuar para pagamento <Icon name="arrow" size={16} /></Button></div></form>}
      {step === 2 && <form onSubmit={(event) => { event.preventDefault(); setStep(3) }}><div className="checkout-title"><p className="eyebrow">Etapa 02</p><h2>Escolha como pagar</h2><p>Esta é uma simulação visual. Nenhuma cobrança ou dado financeiro será processado.</p></div><div className="payment-group"><h3>Recomendados</h3><div className="payment-options"><button type="button" className={payment === 'pix' ? 'active' : ''} onClick={() => setPayment('pix')}><span className="payment-radio" /><span className="payment-icon pix"><Icon name="pix" size={27} /></span><div><strong>Pix</strong><small>Aprovação imediata</small></div></button><button type="button" className={payment === 'boleto' ? 'active' : ''} onClick={() => setPayment('boleto')}><span className="payment-radio" /><span className="payment-icon"><Icon name="barcode" size={27} /></span><div><strong>Boleto</strong><small>Aprovação em 1 a 2 dias úteis</small></div></button></div></div><div className="payment-group"><h3>Cartões</h3><div className="payment-options"><button type="button" className={payment === 'credit' ? 'active' : ''} onClick={() => setPayment('credit')}><span className="payment-radio" /><span className="payment-icon"><Icon name="card" size={27} /></span><div><strong>Cartão de crédito</strong><small>Parcele sua compra em até 12 vezes</small></div></button></div></div>{payment === 'pix' ? <div className="payment-info-panel"><span className="payment-icon pix"><Icon name="pix" size={28} /></span><div><h3>Pagamento rápido e seguro</h3><p>O QR Code seria gerado após a confirmação. Para este projeto, a etapa é apenas demonstrativa.</p></div></div> : payment === 'boleto' ? <div className="payment-info-panel"><span className="payment-icon"><Icon name="barcode" size={28} /></span><div><h3>Boleto bancário</h3><p>O código de barras seria gerado ao finalizar. A confirmação pode levar de 1 a 2 dias úteis.</p></div></div> : <div className="card-fields"><label className="field span-two"><span>Nome impresso no cartão</span><input required value={card.name} onChange={(event) => updateCard('name', event.target.value)} placeholder="Nome completo" /></label><label className="field span-two"><span>Número do cartão</span><input required inputMode="numeric" value={card.number} onChange={(event) => updateCard('number', event.target.value)} placeholder="0000 0000 0000 0000" /></label><label className="field"><span>Validade</span><input required value={card.expiry} onChange={(event) => updateCard('expiry', event.target.value)} placeholder="MM/AA" /></label><label className="field"><span>CVV</span><input required inputMode="numeric" maxLength={4} value={card.cvv} onChange={(event) => updateCard('cvv', event.target.value)} placeholder="123" /></label><label className="field span-two"><span>Parcelamento</span><select value={installments} onChange={(event) => setInstallments(event.target.value)}>{Array.from({ length: 12 }).map((_, index) => { const count = index + 1; return <option key={count} value={count}>{count}x de {currency(total / count)}{count === 1 ? ' à vista' : ''}</option> })}</select></label></div>}<div className="checkout-actions"><Button kind="ghost" onClick={() => setStep(1)}>Voltar</Button><Button type="submit" kind="gold">Revisar pedido <Icon name="arrow" size={16} /></Button></div></form>}
      {step === 3 && <div><div className="checkout-title"><p className="eyebrow">Etapa 03</p><h2>Revise antes de finalizar</h2><p>Confira os dados da entrega e a forma de pagamento escolhida.</p></div><div className="review-block"><div><span>Endereço de entrega</span><button type="button" onClick={() => setStep(1)}>Editar</button></div><p><strong>{address.street}, {address.number}</strong>{address.complement && ` · ${address.complement}`}<br />{address.neighborhood} · {address.city}/{address.state}<br />CEP {address.cep}</p></div><div className="review-block"><div><span>Forma de pagamento</span><button type="button" onClick={() => setStep(2)}>Editar</button></div><p><strong>{paymentLabel}</strong><br />{paymentDetail}</p></div><label className="checkout-terms"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Confirmo que revisei os dados e aceito os termos da compra demonstrativa.</span></label>{orderError && <p className="checkout-error" role="alert">{orderError}</p>}<div className="checkout-actions"><Button kind="ghost" onClick={() => setStep(2)}>Voltar</Button><Button kind="gold" disabled={processing || !accepted} onClick={submitOrder}>{processing ? 'Finalizando…' : 'Finalizar compra'} <Icon name="check" size={16} /></Button></div></div>}
    </main><aside className="checkout-summary"><p className="eyebrow">Resumo do pedido</p><h3>{items.length} {items.length === 1 ? 'obra selecionada' : 'obras selecionadas'}</h3><div className="summary-items">{items.map((item) => <article key={item.id}><div>{item.image && <Image src={item.image} alt={item.title} fill sizes="64px" />}</div><p><strong>{item.title}</strong><span>{item.artistName}</span><b>{currency(item.price)}</b></p></article>)}</div><dl><div><dt>Subtotal</dt><dd>{currency(total)}</dd></div><div><dt>Entrega</dt><dd>Grátis</dd></div>{step > 1 && <div><dt>Pagamento</dt><dd>{paymentLabel}</dd></div>}<div className="summary-total"><dt>Total</dt><dd>{currency(total)}</dd></div></dl><p className="secure-purchase"><Icon name="check" size={15} /> Ambiente de demonstração seguro</p></aside></div>
  </section></div>
}
