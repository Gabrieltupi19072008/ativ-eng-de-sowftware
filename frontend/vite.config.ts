import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Os testes rodam no navegador simulado (jsdom) e com a API simulada (src/mock.ts): não precisam de back-end nem de banco.
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', env: { VITE_USE_MOCK: 'true' }, css: false },
})
