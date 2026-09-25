// Planos comerciais da TrustRetain.
// Valores de demonstração, usados para projetar a receita de assinaturas.

import type { IdPlano } from './types'

export interface Plano {
  id: IdPlano
  nome: string
  /** Número máximo de contratos com retenção ativa. null = sem teto. */
  limiteContratos: number | null
  precoMensalCents: number
  /** Corporativo é cotado caso a caso: o preço é um piso, não um valor fechado. */
  aPartirDe: boolean
  faixa: string
  destaques: string[]
}

export const PLANOS: Plano[] = [
  {
    id: 'essencial',
    nome: 'Essencial',
    limiteContratos: 15,
    precoMensalCents: 250_000, // R$ 2.500,00
    aPartirDe: false,
    faixa: 'Até 15 contratos com retenção ativa',
    destaques: [
      'Contratos, medições e cálculo automático da retenção',
      'Controle de documentos e condições de liberação',
      'Fornecedores convidados sem custo',
    ],
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    limiteContratos: 50,
    precoMensalCents: 500_000, // R$ 5.000,00
    aPartirDe: false,
    faixa: 'Até 50 contratos com retenção ativa',
    destaques: [
      'Tudo do Essencial',
      'Importação de cauções do ERP por CSV',
      'Módulo financeiro opcional por contrato',
    ],
  },
  {
    id: 'corporativo',
    nome: 'Corporativo',
    limiteContratos: null,
    precoMensalCents: 1_000_000, // R$ 10.000,00
    aPartirDe: true,
    faixa: 'Acima de 50 contratos com retenção ativa',
    destaques: [
      'Tudo do Profissional',
      'Volume sem teto, com cotação caso a caso',
      'Acompanhamento dedicado da carteira',
    ],
  },
]

/** Implantação: cobrança única, separada da mensalidade. */
export const IMPLANTACAO = {
  minimoCents: 1_000_000, // R$ 10.000,00
  maximoCents: 3_000_000, // R$ 30.000,00
}

export function acharPlano(id: IdPlano | undefined): Plano | undefined {
  return PLANOS.find((p) => p.id === id)
}

/** Plano indicado para uma quantidade de contratos com retenção ativa. */
export function planoIndicado(contratosComRetencaoAtiva: number): Plano {
  for (const plano of PLANOS) {
    if (plano.limiteContratos === null) return plano
    if (contratosComRetencaoAtiva <= plano.limiteContratos) return plano
  }
  return PLANOS[PLANOS.length - 1]
}

/** True quando o volume atual passou do teto do plano contratado. */
export function planoExcedido(plano: Plano | undefined, contratosComRetencaoAtiva: number): boolean {
  if (!plano || plano.limiteContratos === null) return false
  return contratosComRetencaoAtiva > plano.limiteContratos
}
