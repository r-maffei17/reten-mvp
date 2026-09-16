// Roteamento por hash (#/...). Escolhido de propósito: funciona em qualquer
// hospedagem de arquivos estáticos, sem configuração de servidor.

import { useEffect, useState } from 'react'

export function rotaAtual(): string {
  const hash = window.location.hash.replace(/^#/, '')
  return hash === '' ? '/contratante' : hash
}

export function navegar(rota: string): void {
  window.location.hash = rota
  // Garante que a nova tela comece do topo.
  window.scrollTo({ top: 0 })
}

export function useRota(): string {
  const [rota, setRota] = useState(rotaAtual)
  useEffect(() => {
    const aoMudar = () => setRota(rotaAtual())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  return rota
}

export interface RotaInterpretada {
  segmentos: string[]
}

export function interpretarRota(rota: string): RotaInterpretada {
  return { segmentos: rota.split('/').filter(Boolean) }
}
