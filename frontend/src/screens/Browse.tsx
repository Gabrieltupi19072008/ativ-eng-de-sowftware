import { useCallback, useEffect, useState } from 'react'
import { listPublicArtists } from '../api'
import type { PublicArtist, ArtworkView } from '../types'
import { Image, Icon, Button, currency, DataError } from '../components/ui'
import { filters } from './Shop'

export function ArtistsPage({ openArtist }: { openArtist: (artist: PublicArtist) => void }) {
  const [artists, setArtists] = useState<PublicArtist[] | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(async () => {
    try {
      setArtists(await listPublicArtists())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  return <main className="browse-page"><p className="eyebrow">Quem cria</p><h1>Artistas</h1><p className="browse-intro">Conheça quem pinta, desenha e cria as obras da Nambá Galerie.</p>
    {failed ? <DataError retry={() => void load()} /> : !artists ? <p>Carregando…</p> : artists.length ? <div className="browse-grid">{artists.map((artist) => <article className="browse-card" key={artist.id}>
      <div className="browse-cover">{artist.cover ? <Image src={artist.cover} alt={`Obra de ${artist.name}`} fill sizes="(max-width: 700px) 100vw, 33vw" /> : <span>{artist.name.charAt(0)}</span>}</div>
      <div className="browse-body"><h2>{artist.name}</h2><small>{[artist.city, artist.state].filter(Boolean).join(' · ') || 'Brasil'}{artist.artStyle ? ` · ${artist.artStyle}` : ''}</small>{artist.bio && <p>{artist.bio.length > 140 ? `${artist.bio.slice(0, 140)}…` : artist.bio}</p>}<Button kind="outline" onClick={() => openArtist(artist)}>Ver {artist.works} {artist.works === 1 ? 'obra' : 'obras'}</Button></div>
    </article>)}</div> : <div className="account-empty"><span><Icon name="art" size={25} /></span><h3>Ainda não há artistas com obras à venda</h3><p>Volte em breve.</p></div>}
  </main>
}

export function CollectionsPage({ artworks, openCollection }: { artworks: ArtworkView[]; openCollection: (technique: string) => void }) {
  const collections = filters.slice(1).map((technique) => {
    const works = artworks.filter((art) => art.status === 'published' && art.technique === technique)
    return { technique, works, cover: works[0]?.image ?? '', from: works.length ? Math.min(...works.map((art) => art.price)) : 0 }
  }).filter((collection) => collection.works.length)

  return <main className="browse-page"><p className="eyebrow">Por técnica</p><h1>Coleções</h1><p className="browse-intro">Explore as obras reunidas pela técnica usada em cada uma.</p>
    {collections.length ? <div className="browse-grid">{collections.map((collection) => <article className="browse-card" key={collection.technique}>
      <div className="browse-cover">{collection.cover ? <Image src={collection.cover} alt={`Coleção ${collection.technique}`} fill sizes="(max-width: 700px) 100vw, 33vw" /> : <span>{collection.technique.charAt(0)}</span>}</div>
      <div className="browse-body"><h2>{collection.technique}</h2><small>{collection.works.length} {collection.works.length === 1 ? 'obra' : 'obras'} · a partir de {currency(collection.from)}</small><Button kind="outline" onClick={() => openCollection(collection.technique)}>Ver coleção</Button></div>
    </article>)}</div> : <div className="account-empty"><span><Icon name="art" size={25} /></span><h3>Nenhuma coleção disponível</h3><p>Quando houver obras à venda, as coleções aparecem aqui.</p></div>}
  </main>
}
