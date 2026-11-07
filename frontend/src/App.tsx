import { useCallback, useEffect, useState } from 'react'
import GalerieApp from './GalerieApp'
import type { ArtistCandidate, ArtworkView, UserView } from './types'
import { currentUser, listArtworks, listCandidates } from './api'

type State = { user: UserView | null; artworks: ArtworkView[]; candidates: ArtistCandidate[] }

export default function App() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState(false)
  const [slow, setSlow] = useState(false)

  const load = useCallback(async () => {
    try {
      // As duas chamadas saem juntas (antes uma esperava a outra terminar)
      const [user, artworks] = await Promise.all([currentUser(), listArtworks()])
      const candidates = user?.role === 'admin' ? await listCandidates() : []
      setState({ user, artworks, candidates })
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  // Na hospedagem grátis a API "dorme" quando ninguém usa; a primeira visita pode levar até 1 minuto. Avisa em vez de parecer travado.
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(timer)
  }, [])

  if (error && !state) return <div className="center-state"><h2>Não foi possível conectar</h2><p>Verifique sua conexão ou se o servidor está no ar.</p><button type="button" className="btn btn-gold" onClick={() => { setError(false); void load() }}>Tentar novamente</button></div>
  if (!state) return <div className="center-state"><p>Carregando…</p>{slow && <p className="slow-note">Estamos acordando o servidor. Na primeira visita do dia isso pode levar até 1 minuto, mas só desta vez.</p>}</div>
  return <GalerieApp initialUser={state.user} initialArtworks={state.artworks} initialCandidates={state.candidates} onRefresh={load} />
}
