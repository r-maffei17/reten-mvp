// Regras financeiras da simulação. Camada pura: não conhece React nem localStorage.
//
// Premissas declaradas do MVP:
// - A simulação desconsidera tributos e outros custos.
// - Não há capitalização: o rendimento incide sempre sobre o principal depositado.
// - A mensalidade do plano é separada e não reduz o saldo da contratada.
// - O módulo financeiro é OPCIONAL por contrato. Quando desligado, não há
//   depósito em custódia, rendimento nem participação da plataforma: o contrato
//   acompanha apenas o saldo retido e as condições de liberação.

import { arredondarCents } from './money'
import type { Contrato, Disputa, Documento, LancamentoRendimento, Medicao } from './types'

/** Retenção de uma medição = valor da medição × percentual de retenção. */
export function calcularRetencao(valorMedicaoCents: number, percentualRetencao: number): number {
  return arredondarCents((valorMedicaoCents * percentualRetencao) / 100)
}

/**
 * Data mínima de liberação a partir da conclusão e do prazo contratual.
 * O prazo corre em dias corridos a partir do DIA SEGUINTE à conclusão, então o
 * último dia do prazo é `conclusão + prazo`.
 * Ex.: conclusão em 01/06/2026 com 60 dias → 31/07/2026.
 */
export function calcularDataMinimaLiberacao(dataConclusao: string, prazoDiasCorridos: number): string {
  const [a, m, d] = dataConclusao.split('-').map(Number)
  const data = new Date(a, m - 1, d)
  data.setDate(data.getDate() + prazoDiasCorridos)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export interface ResultadoRendimento {
  principalBaseCents: number
  rendimentoBrutoCents: number
  receitaPlataformaCents: number
  rendimentoContratadaCents: number
}

/**
 * Rendimento de um período.
 * bruto = principal elegível × taxa mensal
 * receita da plataforma = bruto × participação
 * rendimento da contratada = bruto − receita da plataforma
 */
export function calcularRendimento(
  principalBaseCents: number,
  taxaMensalPercentual: number,
  participacaoPercentual: number,
): ResultadoRendimento {
  const rendimentoBrutoCents = arredondarCents((principalBaseCents * taxaMensalPercentual) / 100)
  const receitaPlataformaCents = arredondarCents((rendimentoBrutoCents * participacaoPercentual) / 100)
  // A subtração garante que bruto = plataforma + contratada, sem centavo perdido.
  const rendimentoContratadaCents = rendimentoBrutoCents - receitaPlataformaCents
  return {
    principalBaseCents,
    rendimentoBrutoCents,
    receitaPlataformaCents,
    rendimentoContratadaCents,
  }
}

export interface ResumoContrato {
  moduloFinanceiroAtivo: boolean
  /** Soma das medições registradas. */
  totalMedidoCents: number
  /** Quanto ainda pode ser medido dentro do valor do contrato. */
  saldoAMedirCents: number
  /** Retenções que compõem o principal. Com módulo financeiro, só as depositadas. */
  principalDepositadoCents: number
  /** Retenções registradas mas sem depósito confirmado (zero sem módulo financeiro). */
  principalAguardandoDepositoCents: number
  /** Retenções totais calculadas. */
  retencaoTotalCents: number
  rendimentoBrutoAcumuladoCents: number
  receitaPlataformaAcumuladaCents: number
  rendimentoContratadaAcumuladoCents: number
  /** Principal ainda retido (zera após a liberação). */
  principalRetidoCents: number
  /** Rendimentos da contratada ainda retidos (zera após a liberação). */
  rendimentoRetidoCents: number
  /** principal retido + rendimentos acumulados da contratada. */
  saldoParaLiberacaoCents: number
  /** Valor total já liberado neste contrato. */
  totalLiberadoCents: number
  /** Base do próximo rendimento (0 sem módulo financeiro ou após a liberação). */
  principalElegivelRendimentoCents: number
  medicoesPendentesDeposito: number
  documentosObrigatoriosPendentes: number
  ultimoPeriodoRendimento: string | null
}

export function calcularResumoContrato(
  contrato: Contrato,
  medicoes: Medicao[],
  documentos: Documento[],
  rendimentos: LancamentoRendimento[],
): ResumoContrato {
  const doContrato = medicoes.filter((m) => m.contratoId === contrato.id)
  const docs = documentos.filter((d) => d.contratoId === contrato.id)
  const lancamentos = rendimentos.filter((r) => r.contratoId === contrato.id)
  const comModulo = contrato.moduloFinanceiroAtivo

  const totalMedidoCents = doContrato.reduce((s, m) => s + m.valorCents, 0)
  const retencaoTotalCents = doContrato.reduce((s, m) => s + m.retencaoCents, 0)

  // Sem módulo financeiro não existe etapa de depósito: a retenção registrada já
  // compõe integralmente o saldo retido.
  const principalDepositadoCents = comModulo
    ? doContrato.filter((m) => m.depositoConfirmado).reduce((s, m) => s + m.retencaoCents, 0)
    : retencaoTotalCents
  const principalAguardandoDepositoCents = comModulo
    ? retencaoTotalCents - principalDepositadoCents
    : 0

  const rendimentoBrutoAcumuladoCents = lancamentos.reduce((s, r) => s + r.rendimentoBrutoCents, 0)
  const receitaPlataformaAcumuladaCents = lancamentos.reduce((s, r) => s + r.receitaPlataformaCents, 0)
  const rendimentoContratadaAcumuladoCents = lancamentos.reduce(
    (s, r) => s + r.rendimentoContratadaCents,
    0,
  )

  const liberado = Boolean(contrato.liberadoEm)
  const principalRetidoCents = liberado ? 0 : principalDepositadoCents
  const rendimentoRetidoCents = liberado ? 0 : rendimentoContratadaAcumuladoCents

  const periodos = lancamentos.map((r) => r.periodo).sort()
  const ultimoPeriodoRendimento = periodos.length > 0 ? periodos[periodos.length - 1] : null

  return {
    moduloFinanceiroAtivo: comModulo,
    totalMedidoCents,
    saldoAMedirCents: Math.max(0, contrato.valorTotalCents - totalMedidoCents),
    principalDepositadoCents,
    principalAguardandoDepositoCents,
    retencaoTotalCents,
    rendimentoBrutoAcumuladoCents,
    receitaPlataformaAcumuladaCents,
    rendimentoContratadaAcumuladoCents,
    principalRetidoCents,
    rendimentoRetidoCents,
    saldoParaLiberacaoCents: principalRetidoCents + rendimentoRetidoCents,
    totalLiberadoCents: contrato.liberacao?.totalCents ?? 0,
    principalElegivelRendimentoCents: comModulo && !liberado ? principalDepositadoCents : 0,
    medicoesPendentesDeposito: comModulo ? doContrato.filter((m) => !m.depositoConfirmado).length : 0,
    documentosObrigatoriosPendentes: docs.filter((d) => d.obrigatorio && d.status !== 'aprovado').length,
    ultimoPeriodoRendimento,
  }
}

export function disputaAberta(disputas: Disputa[], contratoId: string): Disputa | undefined {
  return disputas.find((d) => d.contratoId === contratoId && d.status === 'aberta')
}
