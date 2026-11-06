import { expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

export async function abrirApp() {
  render(<App />)
  await screen.findByPlaceholderText('seu@email.com') // tela de login carregou
}

export async function entrar(email: string, senha: string) {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('seu@email.com'), email)
  await user.type(screen.getByPlaceholderText('Sua senha'), senha)
  await user.click(screen.getByRole('button', { name: /^entrar/i }))
  return user
}

// Depois de um login certo o site recarrega a página (window.location.reload) e lê a sessão guardada.
// O jsdom não recarrega página, então interceptamos o recarregamento e abrimos o app de novo, como o navegador faria.
export async function entrarComSucesso(email: string, senha: string) {
  const original = window.location
  const reload = vi.fn()
  vi.stubGlobal('location', { ...original, reload })
  await entrar(email, senha)
  await waitFor(() => expect(reload).toHaveBeenCalled())
  vi.stubGlobal('location', original)
  cleanup()
  render(<App />)
  return userEvent.setup()
}

export const CONTAS = {
  comprador: ['comprador@nambagalerie.com', 'comprador@123'],
  artista: ['comerciante@nambagalerie.com', 'comerciante@123'],
  admin: ['admin@nambagalerie.com', 'nambagalerie@'],
} as const
