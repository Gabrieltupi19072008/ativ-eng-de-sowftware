import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { abrirApp, entrar, entrarComSucesso } from './helpers'

// Testes de ponta a ponta no navegador simulado (jsdom), usando a API simulada (src/mock.ts).
// Servem de rede de proteção: se uma tela parar de abrir ou um fluxo quebrar, o CI avisa antes de chegar na main.

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
