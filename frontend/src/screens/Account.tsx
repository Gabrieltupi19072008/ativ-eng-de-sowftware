import { useState } from 'react'
import type { UserView, ArtworkView } from '../types'
import { AddressesPanel } from './account/AddressesPanel'
import { MyArtworks } from './account/MyArtworks'
import { OrdersPanel } from './account/OrdersPanel'
import { PersonalPanel } from './account/PersonalPanel'
import { SalesPanel } from './account/SalesPanel'
import { SecurityPanel } from './account/SecurityPanel'

export function Account({ user, artworks, back, initialTab = 'personal', onOrdersChange }: { user: UserView; artworks: ArtworkView[]; back: () => void; initialTab?: 'personal' | 'orders' | 'sales'; onOrdersChange?: () => void }) {
  const [tab, setTab] = useState<'personal' | 'addresses' | 'orders' | 'sales' | 'artworks' | 'security'>(initialTab)
  const tabs = [
    { id: 'personal' as const, label: 'Dados pessoais' },
    { id: 'addresses' as const, label: 'Endereços' },
    { id: 'orders' as const, label: 'Pedidos' },
    ...(user.role === 'artist' ? [{ id: 'artworks' as const, label: 'Minhas obras' }, { id: 'sales' as const, label: 'Minhas vendas' }] : []),
    { id: 'security' as const, label: 'Segurança' },
  ]

  return <main className="account-page"><button type="button" className="back-link" onClick={back}>← Voltar para a loja</button><div className="account-header"><span>{user.name.charAt(0)}</span><div><p className="eyebrow">Minha conta</p><h1>{user.name}</h1><p>{user.role === 'buyer' ? 'Perfil de comprador' : user.role === 'artist' ? 'Perfil de artista' : 'Perfil administrativo'}{user.city ? ` · ${user.city}` : ''}</p></div></div><div className="account-grid"><aside>{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} type="button" onClick={() => setTab(item.id)}>{item.label}</button>)}</aside>
    <section>
      {tab === 'personal' && <PersonalPanel user={user} onSaved={onOrdersChange} />}
      {tab === 'addresses' && <AddressesPanel onChange={onOrdersChange} />}
      {tab === 'orders' && <OrdersPanel back={back} onChange={onOrdersChange} />}
      {tab === 'sales' && <SalesPanel />}
      {tab === 'artworks' && <MyArtworks artworks={artworks.filter((art) => art.artistId === user.id)} onChange={onOrdersChange} />}
      {tab === 'security' && <SecurityPanel />}
    </section>
  </div></main>
}
