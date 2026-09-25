// Leitura do CSV de cauções exportado do ERP.
// Camada pura: recebe texto, devolve linhas válidas e erros por linha.

import { calcularRetencao } from './calculos'
import { formatarMoeda, textoParaCents, textoParaNumero } from './money'
import type { LinhaCaucao } from './acoes'

/** Cabeçalhos aceitos, na ordem esperada. A comparação ignora acentos e caixa. */
export const COLUNAS_ESPERADAS = [
  'contrato',
  'fornecedor',
  'valor medido',
  'percentual',
  'valor retido',
  'vencimento',
] as const

export const CSV_EXEMPLO = `contrato;fornecedor;valor medido;percentual;valor retido;vencimento
CT-ERP-101;Andrade Montagens Ltda.;250.000,00;5;12.500,00;30/11/2026
CT-ERP-102;Norte Sul Construções Ltda.;180.000,00;10;18.000,00;15/12/2026
CT-ERP-103;Hidrotec Saneamento Ltda.;96.400,00;5;4.820,00;20/01/2027
`

export interface LinhaLida {
  numero: number
  linha?: LinhaCaucao
  erro?: string
}

export interface ResultadoLeitura {
  linhas: LinhaLida[]
  validas: LinhaCaucao[]
  erroGeral?: string
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** Detecta o separador: ponto e vírgula (padrão brasileiro) ou vírgula. */
function detectarSeparador(cabecalho: string): string {
  return cabecalho.split(';').length >= cabecalho.split(',').length ? ';' : ','
}

/** Converte 'DD/MM/AAAA' ou 'AAAA-MM-DD' para ISO. Devolve null se inválida. */
export function dataParaISO(texto: string): string | null {
  const limpo = texto.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo
  const br = limpo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!br) return null
  const [, d, m, a] = br
  const dia = Number(d)
  const mes = Number(m)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const iso = `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  const teste = new Date(Number(a), mes - 1, dia)
  if (teste.getDate() !== dia || teste.getMonth() !== mes - 1) return null
  return iso
}

export function lerCsvCaucoes(texto: string): ResultadoLeitura {
  const linhasTexto = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')

  if (linhasTexto.length === 0) {
    return { linhas: [], validas: [], erroGeral: 'O arquivo está vazio.' }
  }

  const separador = detectarSeparador(linhasTexto[0])
  const cabecalho = linhasTexto[0].split(separador).map(normalizar)

  const faltando = COLUNAS_ESPERADAS.filter((c) => !cabecalho.includes(c))
  if (faltando.length > 0) {
    return {
      linhas: [],
      validas: [],
      erroGeral: `O arquivo precisa das colunas: ${COLUNAS_ESPERADAS.join(', ')}. Não encontradas: ${faltando.join(', ')}.`,
    }
  }

  const indice = (nome: string) => cabecalho.indexOf(nome)
  const iContrato = indice('contrato')
  const iFornecedor = indice('fornecedor')
  const iValor = indice('valor medido')
  const iPercentual = indice('percentual')
  const iRetido = indice('valor retido')
  const iVencimento = indice('vencimento')

  const linhas: LinhaLida[] = []
  const validas: LinhaCaucao[] = []
  const codigosVistos = new Set<string>()

  for (let i = 1; i < linhasTexto.length; i++) {
    const numero = i + 1
    const campos = linhasTexto[i].split(separador)
    const pegar = (idx: number) => (campos[idx] ?? '').trim()

    const contrato = pegar(iContrato)
    const fornecedor = pegar(iFornecedor)
    const valorMedidoCents = textoParaCents(pegar(iValor))
    const percentual = textoParaNumero(pegar(iPercentual))
    const valorRetidoCents = textoParaCents(pegar(iRetido))
    const vencimento = dataParaISO(pegar(iVencimento))

    if (!contrato) {
      linhas.push({ numero, erro: 'Código do contrato em branco.' })
      continue
    }
    if (codigosVistos.has(contrato.toLowerCase())) {
      linhas.push({ numero, erro: `Código ${contrato} repetido no arquivo.` })
      continue
    }
    if (!fornecedor) {
      linhas.push({ numero, erro: 'Fornecedor em branco.' })
      continue
    }
    if (valorMedidoCents === null || valorMedidoCents <= 0) {
      linhas.push({ numero, erro: 'Valor medido inválido ou não positivo.' })
      continue
    }
    if (percentual === null || percentual < 0 || percentual > 100) {
      linhas.push({ numero, erro: 'Percentual deve ser um número entre 0 e 100.' })
      continue
    }
    if (valorRetidoCents === null || valorRetidoCents < 0) {
      linhas.push({ numero, erro: 'Valor retido inválido.' })
      continue
    }
    if (valorRetidoCents > valorMedidoCents) {
      linhas.push({ numero, erro: 'Valor retido maior que o valor medido.' })
      continue
    }
    const esperado = calcularRetencao(valorMedidoCents, percentual)
    if (esperado !== valorRetidoCents) {
      linhas.push({
        numero,
        erro: `Valor retido não confere: ${percentual}% de ${formatarMoeda(valorMedidoCents)} são ${formatarMoeda(esperado)}, o arquivo traz ${formatarMoeda(valorRetidoCents)}.`,
      })
      continue
    }
    if (!vencimento) {
      linhas.push({ numero, erro: 'Vencimento inválido. Use dia/mês/ano, por exemplo 30/11/2026.' })
      continue
    }

    codigosVistos.add(contrato.toLowerCase())
    const linha: LinhaCaucao = {
      contrato,
      fornecedor,
      valorMedidoCents,
      percentual,
      valorRetidoCents,
      vencimento,
    }
    linhas.push({ numero, linha })
    validas.push(linha)
  }

  return { linhas, validas }
}
