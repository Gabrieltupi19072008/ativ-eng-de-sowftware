import { useCallback, useEffect, useState } from 'react'
import { listApprovedArtists, setArtworkVisibilityAction, getReports, listAdminOrders } from '../api'
import type { UserView, ArtworkView, OrderStatus, AdminOrderView, ReportsView, ArtistCandidate } from '../types'
import { orderStatusLabel, paymentMethodLabel, dateTime, artworkStatusLabel } from '../components/labels'
import { Image, Icon, Logo, Button, currency, DataError } from '../components/ui'
import { ShipmentInfo, ShipmentControls } from './account/OrdersPanel'

export function Admin({ candidates: initial, artworks, user, theme, toggleTheme, back, review, reload, pending, logout }: { candidates: ArtistCandidate[]; artworks: ArtworkView[]; reload: () => void; user: UserView; theme: 'light' | 'dark'; toggleTheme: () => void; back: () => void; review: (id: string, decision: 'approved' | 'rejected', note: string) => void; pending: boolean; logout: () => void }) {
  const [tab, setTab] = useState<'approvals' | 'artists' | 'artworks' | 'orders' | 'reports'>('approvals')
  const [candidates, setCandidates] = useState(initial)
  const [selected, setSelected] = useState<ArtistCandidate | null>(initial[0] ?? null)
  const [artists, setArtists] = useState<ArtistCandidate[] | null>(null)
  const [artistSearch, setArtistSearch] = useState('')
  const [openProfile, setOpenProfile] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [reports, setReports] = useState<ReportsView | null>(null)
  const [adminOrders, setAdminOrders] = useState<AdminOrderView[] | null>(null)
  const [dataFailed, setDataFailed] = useState(false)
  const loadData = useCallback(async () => {
    try {
      const [nextReports, nextOrders, nextArtists] = await Promise.all([getReports(), listAdminOrders(), listApprovedArtists()])
      setReports(nextReports)
      setAdminOrders(nextOrders)
      setArtists(nextArtists)
      setDataFailed(false)
    } catch {
      setDataFailed(true)
    }
  }, [])
  useEffect(() => { if (tab === 'orders' || tab === 'reports' || tab === 'artists') void loadData() }, [tab, loadData])
  // No celular as abas rolam de lado: mantém a aba ativa centralizada
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.admin-sidebar nav')
    const active = nav?.querySelector<HTMLElement>('.active')
    if (nav && active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
  }, [tab])
  useEffect(() => { listApprovedArtists().then(setArtists).catch(() => setDataFailed(true)) }, [])
  const headings = {
    approvals: ['Curadoria de artistas', 'Analise novas solicitações e seus portfólios.'],
    artists: ['Todos os artistas', 'Acompanhe os artistas ativos na Nambá Galerie.'],
    artworks: ['Gestão de obras', 'Visualize o catálogo publicado na plataforma.'],
    orders: ['Pedidos', 'Todas as compras feitas na Nambá Galerie.'],
    reports: ['Relatórios e estatísticas', 'Acompanhe os principais números da Nambá Galerie.'],
  }

  const [artworkBusy, setArtworkBusy] = useState<string | null>(null)
  const [artworkNotice, setArtworkNotice] = useState<{ text: string; error?: boolean } | null>(null)
  async function toggleVisibility(art: ArtworkView) {
    setArtworkBusy(art.id)
    const result = await setArtworkVisibilityAction(art.id, art.status === 'hidden')
    setArtworkNotice({ text: result.message, error: !result.ok })
    setArtworkBusy(null)
    reload()
  }
  function exportArtworks() {
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const rows = [['Obra', 'Artista', 'Técnica', 'Valor (R$)', 'Situação'], ...artworks.map((art) => [art.title, art.artistName, art.technique, art.price.toFixed(2).replace('.', ','), artworkStatusLabel[art.status] ?? art.status])]
    const csv = '\ufeff' + rows.map((row) => row.map(cell).join(';')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'obras-namba-galerie.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function decide(decision: 'approved' | 'rejected') {
    if (!selected) return
    review(selected.id, decision, note)
    if (decision === 'approved') {
      setArtists((current) => current && !current.some((artist) => artist.id === selected.id) ? [...current, selected] : current)
    }
    const next = candidates.filter((item) => item.id !== selected.id)
    setCandidates(next)
    setSelected(next[0] ?? null)
    setNote('')
  }
  return <main className="admin-page"><aside className="admin-sidebar"><Logo light /><div className="admin-user"><span>{user.name.charAt(0)}</span><p><strong>{user.name}</strong><small>Curadoria Nambá</small></p></div><nav><button className={tab === 'approvals' ? 'active' : ''} type="button" onClick={() => setTab('approvals')}><span>01</span>Aprovações <b>{candidates.length}</b></button><button className={tab === 'artists' ? 'active' : ''} type="button" onClick={() => setTab('artists')}><span>02</span>Artistas</button><button className={tab === 'artworks' ? 'active' : ''} type="button" onClick={() => setTab('artworks')}><span>03</span>Obras</button><button className={tab === 'orders' ? 'active' : ''} type="button" onClick={() => setTab('orders')}><span>04</span>Pedidos</button><button className={tab === 'reports' ? 'active' : ''} type="button" onClick={() => setTab('reports')}><span>05</span>Relatórios</button></nav><button type="button" className="admin-theme-toggle" onClick={toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /> <span>Modo {theme === 'dark' ? 'claro' : 'escuro'}</span></button><button type="button" className="sidebar-exit" onClick={logout}><Icon name="logout" size={18} /> Sair</button></aside>
    <section className="admin-main"><header><div><p className="eyebrow">Painel administrativo</p><h1>{headings[tab][0]}</h1><p className="admin-subtitle">{headings[tab][1]}</p></div><Button kind="outline" onClick={back}>Visualizar loja</Button></header><div className="admin-stats"><article><span>Pendentes</span><strong>{candidates.length}</strong><small>aguardando análise</small></article><article><span>Aprovados</span><strong>{artists?.length ?? '—'}</strong><small>artistas ativos</small></article><article><span>Obras</span><strong>{artworks.length}</strong><small>no catálogo</small></article></div>
      {tab === 'approvals' && <div className="review-layout"><section className="candidate-list"><div className="list-heading"><h2>Novas solicitações</h2><span>{candidates.length}</span></div>{candidates.length ? candidates.map((candidate) => <button type="button" key={candidate.id} className={selected?.id === candidate.id ? 'active' : ''} onClick={() => setSelected(candidate)}><span className="candidate-avatar">{candidate.name.charAt(0)}</span><div><strong>{candidate.name}</strong><small>{candidate.artStyle}</small><em>{candidate.city}{candidate.state ? ` · ${candidate.state}` : ''}</em></div><Icon name="arrow" size={17} /></button>) : <div className="list-empty"><Icon name="check" /><p>Fila concluída</p><small>Não há artistas aguardando análise.</small></div>}</section>
        <section className="candidate-detail">{selected ? <><div className="candidate-heading"><div><span className="candidate-avatar large">{selected.name.charAt(0)}</span><div><p className="eyebrow">Candidatura de artista</p><h2>{selected.name}</h2><span>{selected.email} · {selected.city}{selected.state ? `, ${selected.state}` : ''}</span></div></div><small>Enviado em {new Date(selected.createdAt).toLocaleDateString('pt-BR')}</small></div><div className="candidate-bio"><span>Pesquisa artística</span><h3>{selected.artStyle}</h3><p>{selected.artistBio || 'O artista ainda não adicionou uma descrição detalhada.'}</p></div><div className="portfolio-heading"><div><span>Portfólio enviado</span><strong>{selected.portfolio.length} obras</strong></div><p>Clique em uma imagem para ampliar e observar os detalhes.</p></div>{selected.portfolio.length ? <div className="portfolio-grid">{selected.portfolio.map((src, index) => <button type="button" key={src} onClick={() => setLightbox(src)}><Image src={src} alt={`Obra ${index + 1} do portfólio de ${selected.name}`} fill sizes="25vw" /><span>Ampliar</span></button>)}</div> : <div className="portfolio-empty">Nenhuma imagem de portfólio foi anexada.</div>}<label className="field review-field"><span>Observação para o artista (opcional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Explique sua decisão ou solicite ajustes…" /></label><div className="review-actions"><Button kind="danger" disabled={pending} onClick={() => decide('rejected')}><Icon name="close" size={17} /> Rejeitar</Button><Button kind="gold" disabled={pending} onClick={() => decide('approved')}><Icon name="check" size={17} /> Aprovar artista</Button></div></> : <div className="review-complete"><span><Icon name="check" size={32} /></span><h2>Curadoria em dia</h2><p>Todos os cadastros foram analisados.</p></div>}</section>
      </div>}
      {tab === 'artists' && <section className="admin-panel"><div className="panel-heading"><div><h2>Artistas ativos</h2><p>{artists ? `${artists.length} ${artists.length === 1 ? 'perfil aprovado' : 'perfis aprovados'} na plataforma` : 'Carregando…'}</p></div><label className="admin-search"><span>Buscar</span><input placeholder="Nome ou técnica" value={artistSearch} onChange={(event) => setArtistSearch(event.target.value)} /></label></div>
        {artists === null ? <p className="empty-note">{dataFailed ? 'Não foi possível carregar os artistas. Tente de novo em instantes.' : 'Carregando artistas…'}</p> : (() => {
          const term = artistSearch.trim().toLowerCase()
          const shown = artists.filter((artist) => !term || `${artist.name} ${artist.artStyle}`.toLowerCase().includes(term))
          if (!shown.length) return <p className="empty-note">{artists.length ? 'Nenhum artista encontrado para essa busca.' : 'Ainda não há artistas aprovados.'}</p>
          return <div className="artist-admin-grid">{shown.map((artist) => <article key={artist.id}><span className="candidate-avatar large">{artist.name.charAt(0)}</span><div><h3>{artist.name}</h3><p>{artist.artStyle}</p><small>{artist.city}{artist.state ? ` · ${artist.state}` : ''}</small></div><dl><div><dt>Obras</dt><dd>{artworks.filter((art) => art.artistId === artist.id).length}</dd></div><div><dt>Status</dt><dd className="status-active">Ativo</dd></div></dl><Button kind="outline" onClick={() => setOpenProfile(openProfile === artist.id ? null : artist.id)}>{openProfile === artist.id ? 'Fechar perfil' : 'Ver perfil'}</Button>{openProfile === artist.id && <div className="artist-profile"><p><strong>E-mail</strong> {artist.email}</p><p><strong>Cadastro</strong> {new Date(artist.createdAt).toLocaleDateString('pt-BR')}</p><p>{artist.artistBio || 'Este artista ainda não escreveu uma biografia.'}</p></div>}</article>)}</div>
        })()}</section>}
      {tab === 'artworks' && <section className="admin-panel"><div className="panel-heading"><div><h2>Catálogo de obras</h2><p>{artworks.length} obras cadastradas</p></div><Button kind="outline" onClick={exportArtworks}>Exportar lista</Button></div>{artworkNotice && <p className={`orders-notice ${artworkNotice.error ? 'is-error' : 'is-ok'}`} role="status">{artworkNotice.text}</p>}<div className="artwork-admin-table"><div className="table-head"><span>Obra</span><span>Artista</span><span>Técnica</span><span>Valor</span><span>Status</span><span>Ação</span></div>{artworks.map((artwork) => <article key={artwork.id}><div className="admin-artwork-title"><div>{artwork.image && <Image src={artwork.image} alt="" fill sizes="54px" />}</div><strong>{artwork.title}</strong></div><span>{artwork.artistName}</span><span>{artwork.technique}</span><strong>{currency(artwork.price)}</strong><em>{artworkStatusLabel[artwork.status] ?? artwork.status}</em>{artwork.status === 'published' || artwork.status === 'hidden' ? <Button kind="outline" disabled={artworkBusy === artwork.id} onClick={() => void toggleVisibility(artwork)}>{artwork.status === 'hidden' ? 'Republicar' : 'Despublicar'}</Button> : <span />}</article>)}</div></section>}
      {tab === 'orders' && <section className="admin-panel"><div className="panel-heading"><div><h2>Todos os pedidos</h2><p>{adminOrders ? `${adminOrders.length} pedidos registrados` : 'Carregando…'}</p></div></div>
        {dataFailed ? <DataError retry={() => void loadData()} /> : adminOrders && (adminOrders.length ? <div className="orders-list">{adminOrders.map((order) => <article className="order-card" key={order.id}>
          <header><div><strong>Pedido {order.number}</strong><span>{dateTime(order.createdAt)} · {order.buyerName} ({order.buyerEmail})</span></div><em className={`order-status status-${order.status}`}>{orderStatusLabel[order.status]}</em></header>
          <div className="order-items">{order.items.map((item) => <div key={item.artworkId}><div className="order-thumb"><Image src={item.image} alt={item.title} fill sizes="64px" /></div><p><strong>{item.title}</strong><span>{item.artistName}</span></p><b>{currency(item.price)}</b></div>)}</div>
          <dl className="order-info"><div><dt>Pagamento</dt><dd>{order.paymentMethod ? paymentMethodLabel[order.paymentMethod] : '—'}</dd></div><div><dt>Entrega</dt><dd>{order.address.street}, {order.address.number} · {order.address.city}/{order.address.state}</dd></div><div><dt>Total</dt><dd><strong>{currency(order.total)}</strong></dd></div></dl>
          {order.shipment && <ShipmentInfo shipment={order.shipment} />}
          <ShipmentControls orderId={order.id} canShip={order.canShip} canDeliver={order.canDeliver} address={order.address} recipient={order.buyerName} done={() => void loadData()} />
        </article>)}</div> : <div className="account-empty"><span><Icon name="bag" size={25} /></span><h3>Nenhum pedido ainda</h3><p>Quando alguém comprar uma obra, o pedido aparece aqui.</p></div>)}
      </section>}
      {tab === 'reports' && <section className="reports-layout">{dataFailed ? <DataError retry={() => void loadData()} /> : !reports ? <p>Carregando…</p> : <>
        <div className="report-cards"><article><span>Receita</span><strong>{currency(reports.revenue)}</strong><small>pedidos pagos, sem frete</small></article><article><span>Pedidos pagos</span><strong>{reports.paidOrders}</strong><small>pagos, enviados ou entregues</small></article><article><span>Ticket médio</span><strong>{currency(reports.averageTicket)}</strong><small>por pedido pago</small></article></div>
        <div className="reports-grid">
          <section><div className="panel-heading"><div><h2>Vendas por técnica</h2><p>Obras vendidas em pedidos pagos</p></div></div>{reports.salesByTechnique.length ? <div className="technique-report">{reports.salesByTechnique.map((item) => <div key={item.technique}><p><span>{item.technique}</span><strong>{item.sold} · {currency(item.revenue)}</strong></p><meter min="0" max={Math.max(...reports.salesByTechnique.map((entry) => entry.sold), 1)} value={item.sold} /></div>)}</div> : <p className="report-empty">Ainda não há vendas pagas.</p>}</section>
          <section><div className="panel-heading"><div><h2>Artistas que mais vendem</h2><p>Por receita em pedidos pagos</p></div></div>{reports.topArtists.length ? <ol className="top-artists">{reports.topArtists.map((artist) => <li key={artist.name}><span>{artist.name}</span><small>{artist.sold} {artist.sold === 1 ? 'obra' : 'obras'}</small><strong>{currency(artist.revenue)}</strong></li>)}</ol> : <p className="report-empty">Ainda não há vendas pagas.</p>}</section>
          <section><div className="panel-heading"><div><h2>Pedidos por situação</h2><p>Todos os pedidos registrados</p></div></div><div className="curation-summary">{(Object.keys(orderStatusLabel) as OrderStatus[]).map((status) => <div key={status}><span className={`summary-dot order-${status}`} /><p><strong>{reports.ordersByStatus[status] ?? 0}</strong>{orderStatusLabel[status]}</p></div>)}</div></section>
          <section><div className="panel-heading"><div><h2>Catálogo e curadoria</h2><p>Situação atual das obras e dos perfis</p></div></div><div className="curation-summary"><div><span className="summary-dot approved" /><p><strong>{reports.catalog.onSale}</strong>À venda</p></div><div><span className="summary-dot catalogued" /><p><strong>{reports.catalog.outOfStock}</strong>Vendidas ou reservadas</p></div><div><span className="summary-dot pending" /><p><strong>{candidates.length}</strong>Artistas pendentes</p></div></div></section>
        </div></>}</section>}
    </section>{lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><button type="button" aria-label="Fechar"><Icon name="close" /></button><div><Image src={lightbox} alt="Obra ampliada do portfólio" fill sizes="90vw" /></div></div>}</main>
}
