import { useCallback, useEffect, useState } from 'react'
import { cancelOrderAction, deliverOrderAction, shipOrderAction, listOrders, simulatePaymentAction, type ActionResult } from '../../api'
import type { Address, Shipment, OrderView } from '../../types'
import { orderStatusLabel, paymentMethodLabel, dateTime } from '../../components/labels'
import { Image, Icon, Button, currency } from '../../components/ui'

export function OrdersPanel({ back, onChange }: { back: () => void; onChange?: () => void }) {
  const [orders, setOrders] = useState<OrderView[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setOrders(await listOrders())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(id: string, action: (id: string) => Promise<ActionResult>) {
    setBusy(id)
    const result = await action(id)
    setNotice({ text: result.message, error: !result.ok })
    setBusy(null)
    await load()
    onChange?.() // a vitrine muda quando uma obra volta ou é vendida
  }

  if (failed) return <><h2>Meus pedidos</h2><div className="account-empty"><h3>Não foi possível carregar seus pedidos</h3><p>Verifique sua conexão e tente novamente.</p><Button kind="gold" onClick={() => void load()}>Tentar novamente</Button></div></>
  if (!orders) return <><h2>Meus pedidos</h2><p>Carregando…</p></>
  if (!orders.length) return <><h2>Meus pedidos</h2><p>Acompanhe suas compras e consulte pedidos anteriores.</p><div className="account-empty"><span><Icon name="bag" size={25} /></span><h3>Você ainda não fez nenhum pedido</h3><p>As obras compradas e o andamento das entregas aparecerão nesta área.</p><Button kind="gold" onClick={back}>Explorar obras</Button></div></>

  return <><h2>Meus pedidos</h2><p>Acompanhe suas compras e consulte pedidos anteriores.</p>
    {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
    <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}>
      <header><div><strong>Pedido {order.number}</strong><span>{dateTime(order.createdAt)}</span></div><em className={`order-status status-${order.status}`}>{orderStatusLabel[order.status]}</em></header>
      <div className="order-items">{order.items.map((item) => <div key={item.artworkId}><div className="order-thumb"><Image src={item.image} alt={item.title} fill sizes="64px" /></div><p><strong>{item.title}</strong><span>{item.artistName}</span></p><b>{currency(item.price)}</b></div>)}</div>
      <dl className="order-info">
        <div><dt>Pagamento</dt><dd>{order.paymentMethod ? paymentMethodLabel[order.paymentMethod] : '—'}</dd></div>
        <div><dt>Entrega</dt><dd>{order.address.street}, {order.address.number} · {order.address.city}/{order.address.state}</dd></div>
        <div><dt>Total</dt><dd><strong>{currency(order.total)}</strong></dd></div>
      </dl>
      {order.shipment && <ShipmentInfo shipment={order.shipment} />}
      {order.status === 'pending' && order.expiresAt && <p className="order-deadline">Reservado até {dateTime(order.expiresAt)}. Depois disso o pedido é cancelado e a obra volta à vitrine.</p>}
      {(order.canSimulatePayment || order.canCancel) && <div className="order-actions">
        {order.canSimulatePayment && <Button kind="gold" disabled={busy === order.id} onClick={() => void act(order.id, simulatePaymentAction)}>Simular pagamento (teste)</Button>}
        {order.canCancel && <Button kind="outline" disabled={busy === order.id} onClick={() => { if (window.confirm('Cancelar este pedido? As obras voltam para a vitrine.')) void act(order.id, cancelOrderAction) }}>Cancelar pedido</Button>}
      </div>}
    </article>)}</div></>
}

export function ShipmentInfo({ shipment }: { shipment: Shipment }) {
  const date = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
  return <p className="shipment-info"><strong>{shipment.carrier || 'Transportadora'}</strong> · rastreio <b>{shipment.trackingCode}</b>{shipment.shippedAt && <> · enviado em {date(shipment.shippedAt)}</>}{shipment.deliveredAt && <> · entregue em {date(shipment.deliveredAt)}</>}</p>
}

// Marcar envio (com código de rastreio) e entrega. Usado pelo artista (Minhas vendas) e pelo administrador (Pedidos).
export function ShipmentControls({ orderId, canShip, canDeliver, address, recipient, done }: { orderId: string; canShip: boolean; canDeliver: boolean; address?: Address | null; recipient?: string; done: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function act(request: () => Promise<ActionResult>) {
    setBusy(true)
    const result = await request()
    setNotice({ text: result.message, error: !result.ok })
    setBusy(false)
    if (result.ok) done()
  }

  if (!canShip && !canDeliver) return null
  return <div className="shipment-controls">
    {canShip && <>
      {address && <p className="ship-to"><strong>Enviar para{recipient ? ` ${recipient}` : ''}:</strong> {address.street}, {address.number}{address.complement ? ` – ${address.complement}` : ''} · {address.neighborhood} · {address.city}/{address.state} · CEP {address.cep}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void act(() => shipOrderAction(orderId, code)) }}>
        <label className="field"><span>Código de rastreio (Correios)</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex.: AA123456789BR" maxLength={60} required /></label>
        <Button type="submit" kind="gold" disabled={busy}>Marcar como enviado</Button>
      </form>
    </>}
    {canDeliver && <Button kind="gold" disabled={busy} onClick={() => void act(() => deliverOrderAction(orderId))}>Marcar como entregue</Button>}
    {notice && <p className={`orders-notice ${notice.error ? 'is-error' : 'is-ok'}`} role="status">{notice.text}</p>}
  </div>
}
