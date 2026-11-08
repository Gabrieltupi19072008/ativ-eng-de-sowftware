import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Register } from '../screens/Register'
import { DemoBanner } from '../components/Legal'

describe('termos e privacidade', () => {
  it('os links do cadastro abrem os textos e o Esc fecha', async () => {
    const user = userEvent.setup()
    render(<Register role="buyer" setRole={() => {}} back={() => {}} pending={false} submit={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Termos de Uso' }))
    expect(screen.getByRole('dialog', { name: 'Termos de Uso' })).toBeTruthy()
    expect(screen.getByText(/Nenhum pagamento é cobrado/)).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Política de Privacidade' }))
    expect(screen.getByRole('dialog', { name: 'Política de Privacidade' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a faixa avisa que é demonstração', () => {
    render(<DemoBanner />)
    expect(screen.getByRole('note').textContent).toMatch(/Versão de demonstração/)
  })
})
