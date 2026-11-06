import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { abrirApp, CONTAS, entrarComSucesso } from './helpers'

// Cada teste abre uma tela do site e confere o título dela. Com VITE_SNAPSHOT_TELAS=1 também guarda o HTML inteiro da tela:
// foi assim que conferimos que dividir o GalerieApp.tsx em vários arquivos não mudou nenhuma tela (rode antes e depois da mudança).
const guardar = () => { if (import.meta.env.VITE_SNAPSHOT_TELAS) expect(document.body.innerHTML).toMatchSnapshot() }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }) // datas e números de pedido ficam iguais a cada rodada
  vi.setSystemTime(new Date('2026-11-06T12:00:00Z'))
})
afterEach(() => { vi.useRealTimers() })

async function como(perfil: keyof typeof CONTAS) {
  await abrirApp()
  return entrarComSucesso(CONTAS[perfil][0], CONTAS[perfil][1])
}
const clicar = async (user: ReturnType<typeof userEvent.setup>, nome: string | RegExp, indice = 0) => user.click(screen.getAllByRole('button', { name: nome })[indice])
const abrirConta = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(document.querySelector('.avatar') as HTMLElement)
  await clicar(user, /minha conta/i)
}

describe('visitante', () => {
  it('capa e login', async () => { await abrirApp(); guardar() })
  it('cadastro de comprador', async () => {
    await abrirApp(); const user = userEvent.setup()
    await clicar(user, 'Criar conta'); await screen.findByText('Comece sua coleção.'); guardar()
  })
  it('cadastro de artista', async () => {
    await abrirApp(); const user = userEvent.setup()
    await clicar(user, 'Criar conta'); await clicar(user, 'Artista'); await screen.findByText('Apresente sua arte ao mundo.'); guardar()
  })
  it('esqueci minha senha', async () => {
    await abrirApp(); const user = userEvent.setup()
    await clicar(user, /esqueci minha senha/i); await screen.findByText('Esqueceu a senha?'); guardar()
  })
  it('criar nova senha pelo link', async () => {
    window.history.replaceState({}, '', '/?reset=token-qualquer')
    render(<App />); await screen.findByText('Crie uma nova senha'); guardar()
  })
})

describe('comprador', () => {
  it('vitrine', async () => { await como('comprador'); await screen.findByText('Galeria em destaque'); guardar() })
  it('página de artistas', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await clicar(user, 'Artistas'); await screen.findByText('Quem cria'); guardar()
  })
  it('página de coleções', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await clicar(user, 'Coleções'); await screen.findByText('Por técnica'); guardar()
  })
  it('detalhe da obra', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await clicar(user, /ver detalhes/i); await screen.findByText('Certificado incluso'); guardar()
  })
  it('carrinho com uma obra', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await user.click(screen.getAllByLabelText('Adicionar ao carrinho')[0])
    await user.click(screen.getByLabelText('Abrir carrinho')); await screen.findByText('Sua seleção'); guardar()
  })
  it('checkout: entrega, pagamento e revisão', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await user.click(screen.getAllByLabelText('Adicionar ao carrinho')[0])
    await user.click(screen.getByLabelText('Abrir carrinho'))
    await clicar(user, 'Continuar compra'); await screen.findByText('Onde sua obra será entregue?'); guardar()
  })
  it('conta: dados pessoais', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await abrirConta(user); await screen.findByText('Dados pessoais', { selector: 'h2' }); guardar()
  })
  it('conta: endereços', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await abrirConta(user); await clicar(user, 'Endereços'); await screen.findByText('Endereços', { selector: 'h2' }); guardar()
  })
  it('conta: pedidos', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await abrirConta(user); await clicar(user, 'Pedidos'); await screen.findByText('Meus pedidos', { selector: 'h2' }); guardar()
  })
  it('conta: segurança', async () => {
    const user = await como('comprador'); await screen.findByText('Galeria em destaque')
    await abrirConta(user); await clicar(user, 'Segurança'); await screen.findByText('Segurança', { selector: 'h2' }); guardar()
  })
})

describe('artista', () => {
  it('cadastro de obra', async () => {
    const user = await como('artista'); await screen.findByText('Galeria em destaque')
    await clicar(user, /adicionar arte/i); await screen.findByText('Conte a história da sua obra.'); guardar()
  })
  it('conta: minhas obras', async () => {
    const user = await como('artista'); await screen.findByText('Galeria em destaque')
    await abrirConta(user); await clicar(user, 'Minhas obras'); await screen.findByText('Minhas obras', { selector: 'h2' }); guardar()
  })
  it('conta: minhas vendas', async () => {
    const user = await como('artista'); await screen.findByText('Galeria em destaque')
    await abrirConta(user); await clicar(user, 'Minhas vendas'); await screen.findByText('Minhas vendas', { selector: 'h2' }); guardar()
  })
})

describe('administrador', () => {
  const abas: [string, RegExp, string][] = [
    ['aprovações', /Aprovações/, 'Curadoria de artistas'],
    ['artistas', /Artistas/, 'Todos os artistas'],
    ['obras', /Obras/, 'Gestão de obras'],
    ['pedidos', /Pedidos/, 'Pedidos'],
    ['relatórios', /Relatórios/, 'Relatórios e estatísticas'],
  ]
  for (const [nome, botao, titulo] of abas) {
    it(`painel: ${nome}`, async () => {
      const user = await como('admin'); await screen.findByText('Curadoria de artistas')
      await clicar(user, botao); await screen.findByRole('heading', { level: 1, name: titulo }); guardar()
    })
  }
})
