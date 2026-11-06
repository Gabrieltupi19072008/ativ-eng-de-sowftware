import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// O jsdom não implementa estas APIs de navegador que a capa e o tema usam.
window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }))
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
Element.prototype.scrollIntoView = vi.fn()
class FakeObserver { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
vi.stubGlobal('IntersectionObserver', FakeObserver)
vi.stubGlobal('ResizeObserver', FakeObserver)

afterEach(() => {
  cleanup()
  localStorage.clear() // o modo simulado guarda contas e pedidos no localStorage: cada teste começa do zero
  window.history.replaceState({}, '', '/')
})
