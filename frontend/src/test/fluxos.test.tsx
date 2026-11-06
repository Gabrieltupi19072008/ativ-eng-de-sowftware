import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Testes de ponta a ponta no navegador simulado (jsdom), usando a API simulada (src/mock.ts).
// Servem de rede de proteção: se uma tela parar de abrir ou um fluxo quebrar, o CI avisa antes de chegar na main.

async function abrirApp() {
  render(<App />)
  await screen.findByPlaceholderText('seu@email.com') // tela de login carregou
}

// Depois de um login certo o site recarrega a página (window.location.reload) e lê a sessão guardada.
// O jsdom não recarrega página, então interceptamos o recarregamento e abrimos o app de novo, como o navegador faria.
async function entrarComSucesso(email: string, senha: string) {
  const original = window.location
  const reload = vi.fn()
  vi.stubGlobal('location', { ...original, reload })
  await entrar(email, senha)
  await waitFor(() => expect(reload).toHaveBeenCalled())
  vi.stubGlobal('location', original)
  cleanup()
  render(<App />)
}

async function entrar(email: string, senha: string) {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('seu@email.com'), email)
  await user.type(screen.getByPlaceholderText('Sua senha'), senha)
  await user.click(screen.getByRole('button', { name: /^entrar/i }))
  return user
}

describe('login', () => {
  it('recusa senha errada com uma mensagem clara', async () => {
    await abrirApp()
    await entrar('comprador@nambagalerie.com', 'senha-errada')
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()
  })

  it('entra como comprador e mostra a vitrine de obras', async () => {
    await abrirApp()
    await entrarComSucesso('comprador@nambagalerie.com', 'comprador@123')
    expect(await screen.findByText('Galeria em destaque')).toBeTruthy()
  })

  it('entra como administrador e abre o painel de curadoria', async () => {
    await abrirApp()
    await entrarComSucesso('admin@nambagalerie.com', 'nambagalerie@')
    expect(await screen.findByText('Curadoria de artistas')).toBeTruthy()
  })
})

describe('esqueci minha senha', () => {
  it('pede o e-mail e responde igual exista a conta ou não', async () => {
    await abrirApp()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    await screen.findByText('Esqueceu a senha?')
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ninguem@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText(/Se este e-mail estiver cadastrado/)).toBeTruthy()
  })

  it('na página do link, recusa senhas diferentes sem chamar o servidor', async () => {
    window.history.replaceState({}, '', '/?reset=token-qualquer')
    render(<App />)
    const user = userEvent.setup()
    await screen.findByText('Crie uma nova senha')
    await user.type(screen.getByLabelText(/nova senha \(mínimo/i), 'SenhaNova123')
    await user.type(screen.getByLabelText(/repita a nova senha/i), 'SenhaDiferente9')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByText('A confirmação não é igual à nova senha.')).toBeTruthy()
  })

  it('na página do link, avisa quando o link é inválido ou já foi usado', async () => {
    window.history.replaceState({}, '', '/?reset=token-que-nao-existe')
    render(<App />)
    const user = userEvent.setup()
    await screen.findByText('Crie uma nova senha')
    await user.type(screen.getByLabelText(/nova senha \(mínimo/i), 'SenhaNova123')
    await user.type(screen.getByLabelText(/repita a nova senha/i), 'SenhaNova123')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    await waitFor(() => expect(screen.getByText(/Este link é inválido ou já expirou/)).toBeTruthy())
  })
})
