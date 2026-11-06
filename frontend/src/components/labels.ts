import type { OrderStatus, PaymentMethod } from '../types'

export const orderStatusLabel: Record<OrderStatus, string> = { pending: 'Aguardando pagamento', paid: 'Pago', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }

export const paymentMethodLabel: Record<PaymentMethod, string> = { pix: 'Pix', boleto: 'Boleto', credit: 'Cartão de crédito' }

export const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const artworkStatusLabel: Record<string, string> = { published: 'Publicada', draft: 'Rascunho', hidden: 'Despublicada', reserved: 'Reservada', sold: 'Vendida' }
