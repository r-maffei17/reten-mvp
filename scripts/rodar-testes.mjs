// Empacota os testes em TypeScript com o esbuild (já disponível via Vite) e
// executa no runner nativo do Node. Evita dependências extras de teste.

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { build } from 'esbuild'

const saida = '.build-testes'
rmSync(saida, { recursive: true, force: true })
mkdirSync(saida, { recursive: true })

await build({
  entryPoints: ['tests/regras.test.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: `${saida}/regras.test.mjs`,
  external: ['node:*'],
  logLevel: 'warning',
})

execFileSync(process.execPath, ['--test', `${saida}/regras.test.mjs`], { stdio: 'inherit' })
