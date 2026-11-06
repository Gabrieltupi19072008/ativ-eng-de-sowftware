import { useCallback, useEffect, useState } from 'react'
import { listSales } from '../../api'
import type { SaleView } from '../../types'
import { orderStatusLabel, dateTime } from '../../components/labels'
import { Image, Icon, currency, DataError } from '../../components/ui'
import { ShipmentInfo, ShipmentControls } from './OrdersPanel'

export function SalesPanel() {
  const [sales, setSales] = useState<SaleView[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      setSales(await listSales())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (failed) return <><h2>Minhas vendas</h2><DataError retry={() => void load()} /></>
  if (!sales) return <><h2>Minhas vendas</h2><p>Carregando…</p></>

  const paid = sales.filter((sale) => sale.status !== 'pending')
  const total = paid.reduce((sum, sale) => sum + sale.price, 0)
  if (!sales.length) return <><h2>Minhas vendas</h2><p>Acompanhe as obras que já foram compradas.</p><div className="account-empty"><span><Icon name="bag" size={25} /></span><h3>Nenhuma venda ainda</h3><p>Quando alguém comprar uma das suas obras, ela aparece aqui.</p></div></>

  return <><h2>Minhas vendas</h2><p>Acompanhe as obras que já foram compradas.</p>
    <div className="sales-summary"><div><span>Obras vendidas</span><strong>{paid.length}</strong></div><div><span>Total vendido</span><strong>{currency(total)}</strong></div><div><span>Aguardando pagamento</span><strong>{sales.length - paid.length}</strong></div></div>
    <div className="orders-list">{sales.map((sale, index) => <article className="order-card" key={`${sale.orderId}-${sale.artworkId}`}>
      <header><div><strong>Pedido {sale.orderNumber}</strong><span>{dateTime(sale.createdAt)}</span></div><em className={`order-status status-${sale.status}`}>{orderStatusLabel[sale.status]}</em></header>
      <div className="order-items"><div><div className="order-thumb"><Image src={sale.image} alt={sale.title} fill sizes="64px" /></div><p><strong>{sale.title}</strong><span>Comprador: {sale.buyerName}{sale.buyerCity ? ` · ${sale.buyerCity}${sale.buyerState ? `/${sale.buyerState}` : ''}` : ''}</span></p><b>{currency(sale.price)}</b></div></div>
      {sale.shipment && <ShipmentInfo shipment={sale.shipment} />}
      {sales.findIndex((other) => other.orderId === sale.orderId) === index && <ShipmentControls orderId={sale.orderId} canShip={sale.canShip} canDeliver={sale.canDeliver} address={sale.shippingAddress} recipient={sale.buyerName} done={() => void load()} />}
    </article>)}</div></>
}
