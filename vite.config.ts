import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' mantém o build funcionando em qualquer subpasta de hospedagem
// (GitHub Pages, Netlify, Vercel ou um simples servidor de arquivos).
export default defineConfig({
  plugins: [react()],
  base: './',
})
