import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' (caminhos relativos) mantém o build funcionando em qualquer pasta de
// hospedagem, sem precisar fixar o nome do repositório:
//   - GitHub Pages de projeto:  https://usuario.github.io/reten-mvp/
//   - Netlify/Vercel na raiz:   https://algum-nome.netlify.app/
//   - abrindo a pasta dist localmente
// Fixar base: '/reten-mvp/' também funcionaria no Pages, mas quebraria nos outros
// casos e ao renomear o repositório. As rotas usam '#' pelo mesmo motivo: nenhuma
// configuração de servidor é necessária.
// Para conferir: npm run build && node scripts/servir-subpasta.mjs
export default defineConfig({
  plugins: [react()],
  base: './',
})
