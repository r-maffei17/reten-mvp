// Utilitários monetários. Regra: todo valor circula em CENTAVOS (inteiro).

/** Arredonda para o centavo mais próximo (meio para cima), evitando -0. */
export function arredondarCents(valor: number): number {
  const r = Math.round(valor)
  return r === 0 ? 0 : r
}

/** Converte um texto digitado ("1.000,50" ou "1000.50") para centavos. Retorna null se inválido. */
export function textoParaCents(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/R\$/gi, '')
  if (limpo === '') return null
  let normalizado: string
  if (limpo.includes(',')) {
    // Formato brasileiro: ponto é separador de milhar, vírgula é decimal.
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else {
    normalizado = limpo
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null
  const numero = Number(normalizado)
  if (!Number.isFinite(numero)) return null
  return arredondarCents(numero * 100)
}

/** Formata centavos como moeda brasileira: 500000 -> "R$ 5.000,00". */
export function formatarMoeda(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Formata centavos sem o símbolo: 500000 -> "5.000,00". */
export function formatarValor(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Formata um percentual: 0.8 -> "0,8%". */
export function formatarPercentual(percentual: number, casas = 2): string {
  return `${percentual.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })}%`
}

/** Converte um texto digitado ("0,8") para número percentual. Retorna null se inválido. */
export function textoParaNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(',', '.')
  if (limpo === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : null
}
