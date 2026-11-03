import { useCallback, useEffect, useState } from 'react'
import GalerieApp, { type ArtistCandidate, type ArtworkView, type UserView } from './GalerieApp'
import { currentUser, listArtworks, listCandidates } from './api'

type State = { user: UserView | null; artworks: ArtworkView[]; candidates: ArtistCandidate[] }

export default function App() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const user = await currentUser()
      const [artworks, candidates] = await Promise.all([listArtworks(), user?.role === 'admin' ? listCandidates() : Promise.resolve([])])
      setState({ user, artworks, candidates })
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (error && !state) return <div className="center-state"><h2>Não foi possível conectar</h2><p>Verifique sua conexão ou se o servidor está no ar.</p><button type="button" className="btn btn-gold" onClick={() => { setError(false); void load() }}>Tentar novamente</button></div>
  if (!state) return <div className="center-state"><p>Carregando…</p></div>
  return <GalerieApp initialUser={state.user} initialArtworks={state.artworks} initialCandidates={state.candidates} onRefresh={load} />
}
