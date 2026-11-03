// Contas de teste: existem no modo simulado e são criadas no banco pelo `python seed.py` do back-end.
// Só para desenvolvimento. Os botões de acesso rápido do login usam estas contas.
export const DEMO_ACCOUNTS = {
  buyer: { email: 'comprador@nambagalerie.com', password: 'comprador@123' },
  artist: { email: 'comerciante@nambagalerie.com', password: 'comerciante@123' },
  admin: { email: 'admin@nambagalerie.com', password: 'nambagalerie@' },
} as const
