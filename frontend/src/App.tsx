import { useCallback, useEffect, useState } from 'react'
import GalerieApp, { type ArtistCandidate, type ArtworkView, type UserView } from './GalerieApp'
import { currentUser, listArtworks, listCandidates } from './api'

type State = { user: UserView | null; artworks: ArtworkView[]; candidates: ArtistCandidate[] }

export default function App() {
  const [state, setState] = useState<State | null>(null)

  const load = useCallback(async () => {
    const [user, artworks, candidates] = await Promise.all([currentUser(), listArtworks(), listCandidates()])
    setState({ user, artworks, candidates })
  }, [])

  useEffect(() => { void load() }, [load])

  if (!state) return <div className="center-state"><p>Carregando…</p></div>
  return <GalerieApp initialUser={state.user} initialArtworks={state.artworks} initialCandidates={state.candidates} onRefresh={load} />
}
