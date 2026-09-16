// Regras financeiras da simulação. Camada pura: não conhece React nem localStorage.
//
// Premissas declaradas do MVP:
// - A simulação desconsidera tributos e outros custos.
// - Não há capitalização: o rendimento incide sempre sobre o principal depositado.
// - A mensalidade da plataforma é separada e não reduz o saldo da contratada.

import { arredondarCents } from './money'
import type {
  Configuracoes,
  Contrato,
  Disputa,
  Documento,
  LancamentoRendimento,
  Medicao,
} from './types'

/** Retenção de uma medição = valor da medição × percentual de retenção. */
export function calcularRetencao(valorMedicaoCents: number, percentualRetencao: number): number {
  return arredondarCents((valorMedicaoCents * percentualRetencao) / 100)
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
  /** Soma das medições registradas. */
  totalMedidoCents: number
  /** Quanto ainda pode ser medido dentro do valor do contrato. */
  saldoAMedirCents: number
  /** Retenções com depósito simulado confirmado (base do rendimento). */
  principalDepositadoCents: number
  /** Retenções registradas mas sem depósito confirmado. */
  principalAguardandoDepositoCents: number
  /** Retenções totais calculadas (depositadas ou não). */
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
  /** Base do próximo rendimento (0 se o contrato já foi liberado). */
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

  const totalMedidoCents = doContrato.reduce((s, m) => s + m.valorCents, 0)
  const retencaoTotalCents = doContrato.reduce((s, m) => s + m.retencaoCents, 0)
  const principalDepositadoCents = doContrato
    .filter((m) => m.depositoConfirmado)
    .reduce((s, m) => s + m.retencaoCents, 0)
  const principalAguardandoDepositoCents = retencaoTotalCents - principalDepositadoCents

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
    principalElegivelRendimentoCents: liberado ? 0 : principalDepositadoCents,
    medicoesPendentesDeposito: doContrato.filter((m) => !m.depositoConfirmado).length,
    documentosObrigatoriosPendentes: docs.filter((d) => d.obrigatorio && d.status !== 'aprovado').length,
    ultimoPeriodoRendimento,
  }
}

/** Receita mensal projetada de assinaturas = nº de contratantes × mensalidade. */
export function calcularReceitaAssinaturasMensal(
  quantidadeContratantes: number,
  config: Configuracoes,
): number {
  return quantidadeContratantes * config.mensalidadeCents
}

export function disputaAberta(disputas: Disputa[], contratoId: string): Disputa | undefined {
  return disputas.find((d) => d.contratoId === contratoId && d.status === 'aberta')
}
