// Serve dist/ sob o prefixo /reten-mvp/, imitando o GitHub Pages de um repositório de projeto.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }

createServer(async (req, res) => {
  const caminho = decodeURIComponent(req.url.split('?')[0].split('#')[0])
  if (!caminho.startsWith('/reten-mvp/')) {
    res.writeHead(404); res.end('fora do prefixo /reten-mvp/'); return
  }
  let relativo = caminho.slice('/reten-mvp/'.length)
  if (relativo === '' || relativo.endsWith('/')) relativo += 'index.html'
  try {
    const conteudo = await readFile(join('dist', relativo))
    res.writeHead(200, { 'content-type': TIPOS[extname(relativo)] ?? 'application/octet-stream' })
    res.end(conteudo)
  } catch {
    res.writeHead(404); res.end('nao encontrado: ' + relativo)
  }
}).listen(4199, () => console.log('servindo dist/ em http://localhost:4199/reten-mvp/'))
