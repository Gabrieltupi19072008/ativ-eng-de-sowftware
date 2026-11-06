export type Address = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export const emptyAddress: Address = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }

export type UserView = {
  id: string
  name: string
  email: string
  role: 'buyer' | 'artist' | 'admin'
  artistStatus?: 'not-applicable' | 'pending' | 'approved' | 'rejected' | null
  city: string
  state?: string
  phone?: string
  bio?: string
  birthDate?: string
  address?: Address
}

export type PublicArtist = { id: string; name: string; city: string; state: string; artStyle: string; bio: string; works: number; cover: string }

export type SavedAddress = Address & { id: string }

export type ArtworkView = {
  id: string
  title: string
  artistId: string
  artistName: string
  technique: string
  description: string
  price: number
  year?: number
  width?: number
  height?: number
  image: string
  status: string
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'

export type PaymentMethod = 'pix' | 'boleto' | 'credit'

export type Shipment = { trackingCode: string; carrier: string; shippedAt: string | null; deliveredAt: string | null }

export type OrderView = {
  id: string
  number: string
  status: OrderStatus
  createdAt: string
  expiresAt: string | null
  subtotal: number
  shipping: number
  total: number
  deliveryType: 'shipping' | 'pickup'
  paymentMethod: PaymentMethod | null
  paymentStatus: string | null
  items: { artworkId: string; title: string; artistName: string; price: number; image: string }[]
  address: Address
  shipment?: Shipment | null
  canCancel: boolean
  canSimulatePayment: boolean
}

export type SaleView = {
  orderId: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  artworkId: string
  title: string
  artistName: string
  image: string
  price: number
  buyerName: string
  buyerCity: string
  buyerState: string
  shipment: Shipment | null
  canShip: boolean
  canDeliver: boolean
  shippingAddress: Address | null
}

export type AdminOrderView = OrderView & { buyerName: string; buyerEmail: string; canShip: boolean; canDeliver: boolean }

export type ReportsView = {
  revenue: number
  paidOrders: number
  averageTicket: number
  ordersByStatus: Record<OrderStatus, number>
  catalog: { onSale: number; outOfStock: number; drafts: number }
  topArtists: { name: string; sold: number; revenue: number }[]
  salesByTechnique: { technique: string; sold: number; revenue: number }[]
}

export type ArtistCandidate = {
  id: string
  name: string
  email: string
  city: string
  state: string
  artStyle: string
  artistBio: string
  createdAt: string
  portfolio: string[]
}
