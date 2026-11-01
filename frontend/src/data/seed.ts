import type { ArtistCandidate, ArtworkView } from '../GalerieApp'

export const seedArtworks: ArtworkView[] = [
  { id: 'f1', title: 'Entardecer no Cerrado', artistName: 'Mariana Luz', technique: 'Acrílica', description: 'Camadas quentes inspiradas no horizonte do cerrado.', price: 1200, year: 2025, width: 60, height: 80, image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=900&q=85', status: 'published' },
  { id: 'f2', title: 'Azul em Movimento', artistName: 'Carlos Neves', technique: 'Óleo', description: 'Gestos livres em azul profundo e amarelo mineral.', price: 2800, year: 2024, width: 90, height: 120, image: 'https://images.unsplash.com/photo-1552312097-8ef75595e2a2?auto=format&fit=crop&w=900&q=85', status: 'published' },
  { id: 'f3', title: 'Jardim Suspenso', artistName: 'Ana Beatriz', technique: 'Aquarela', description: 'Estudo botânico de transparências e luz.', price: 950, year: 2026, width: 42, height: 59, image: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=900&q=85', status: 'published' },
  { id: 'f4', title: 'Geometria Urbana', artistName: 'Pedro Alves', technique: 'Arte Digital', description: 'Arquitetura imaginada a partir de ritmos urbanos.', price: 1750, year: 2025, width: 70, height: 70, image: 'https://images.unsplash.com/photo-1533208087231-c3618eab623c?auto=format&fit=crop&w=900&q=85', status: 'published' },
  { id: 'f5', title: 'Vermelho Essencial', artistName: 'Lúcia Ferreira', technique: 'Pastel', description: 'Cor e matéria em equilíbrio silencioso.', price: 3400, year: 2023, width: 80, height: 100, image: 'https://images.unsplash.com/photo-1533157950006-c38844053d55?auto=format&fit=crop&w=900&q=85', status: 'published' },
  { id: 'f6', title: 'Cartografia Afetiva', artistName: 'Thiago Ramos', technique: 'Técnica Mista', description: 'Memórias transformadas em paisagens abstratas.', price: 880, year: 2026, width: 50, height: 70, image: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?auto=format&fit=crop&w=900&q=85', status: 'published' },
]

export const seedCandidates: ArtistCandidate[] = [
  {
    id: 'preview-isabela',
    name: 'Isabela Monteiro',
    email: 'isabela@galerie.demo',
    city: 'Belo Horizonte',
    state: 'MG',
    artStyle: 'Abstracionismo',
    artistBio: 'Pesquisa cor, gesto e memória em composições abstratas construídas por camadas.',
    createdAt: '2026-10-27T19:25:43.563Z',
    portfolio: [
      'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    id: 'preview-diego',
    name: 'Diego Cavalcante',
    email: 'diego@galerie.demo',
    city: 'Recife',
    state: 'PE',
    artStyle: 'Pintura gestual',
    artistBio: 'Investiga ritmo, matéria e paisagem por meio de pinceladas livres e contrastes intensos.',
    createdAt: '2026-10-27T19:25:47.422Z',
    portfolio: [
      'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=900&q=85',
    ],
  },
]
