// Consultas derivadas do estado, usadas pelas telas. Camada pura.

import { calcularResumoContrato, disputaAberta, type ResumoContrato } from './calculos'
import { formatarData } from './datas'
import { avaliarLiberacaoDoEstado, type AvaliacaoLiberacao } from './elegibilidade'
import { acharPlano, planoExcedido, planoIndicado, type Plano } from './planos'
import type { Contrato, Disputa, Documento, Empresa, EstadoDemo, Medicao } from './types'

export interface ContratoDetalhado {
  contrato: Contrato
  contratante: Empresa | undefined
  contratada: Empresa | undefined
  resumo: ResumoContrato
  avaliacao: AvaliacaoLiberacao
  disputaEmAberto: Disputa | undefined
  medicoes: Medicao[]
  documentos: Documento[]
}

export function detalharContrato(estado: EstadoDemo, contrato: Contrato): ContratoDetalhado {
  return {
    contrato,
    contratante: estado.contratantes.find((e) => e.id === contrato.contratanteId),
    contratada: estado.contratadas.find((e) => e.id === contrato.contratadaId),
    resumo: calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos),
    avaliacao: avaliarLiberacaoDoEstado(estado, contrato),
    disputaEmAberto: disputaAberta(estado.disputas, contrato.id),
    medicoes: estado.medicoes
      .filter((m) => m.contratoId === contrato.id)
      .sort((a, b) => (a.data < b.data ? -1 : 1)),
    documentos: estado.documentos.filter((d) => d.contratoId === contrato.id),
  }
}

export function detalharTodos(estado: EstadoDemo): ContratoDetalhado[] {
  return estado.contratos.map((c) => detalharContrato(estado, c))
}

/** Contratos com retenção ativa: nem liberados, nem sem saldo. Base da faixa do plano. */
export function contratosComRetencaoAtiva(estado: EstadoDemo, contratanteId?: string): number {
  return detalharTodos(estado).filter(
    (d) =>
      !d.contrato.liberadoEm &&
      d.resumo.retencaoTotalCents > 0 &&
      (contratanteId === undefined || d.contrato.contratanteId === contratanteId),
  ).length
}

export interface Pendencia {
  contratoId: string
  codigo: string
  nomeContrato: string
  empresa: string
  titulo: string
  /** O que precisa acontecer, em texto corrido. */
  motivo: string
  /** Quem precisa agir. */
  responsavel: string
  /** Data limite, quando houver. */
  prazo?: string
  prioridade: number
}

/** Pendências priorizadas para o painel da contratante. */
export function listarPendenciasContratante(estado: EstadoDemo): Pendencia[] {
  const pendencias: Pendencia[] = []

  for (const detalhe of detalharTodos(estado)) {
    const { contrato, resumo, avaliacao, disputaEmAberto, documentos, contratada, contratante } = detalhe
    if (contrato.liberadoEm) continue
    const base = {
      contratoId: contrato.id,
      codigo: contrato.codigo,
      nomeContrato: contrato.nome,
      empresa: contratada?.nome ?? '—',
    }
    const daContratante = contratante?.contato ?? 'Contratante'
    const daContratada = contratada?.contato ?? 'Contratada'

    if (contrato.liberacaoSolicitadaEm && avaliacao.status === 'solicitada') {
      pendencias.push({
        ...base,
        titulo: 'Liberação solicitada',
        motivo: 'A contratada solicitou a liberação. Revise as condições e confirme.',
        responsavel: daContratante,
        prioridade: 1,
      })
    }

    for (const doc of documentos.filter((d) => d.status === 'enviado')) {
      pendencias.push({
        ...base,
        titulo: `Analisar documento: ${doc.nome}`,
        motivo: doc.recebidoEm
          ? `Recebimento confirmado em ${formatarData(doc.recebidoEm)}. Versão ${doc.versaoAtual} aguardando análise.`
          : `Versão ${doc.versaoAtual} enviada em ${formatarData(doc.enviadoEm)}, aguardando confirmação de recebimento e análise.`,
        responsavel: daContratante,
        prazo: doc.prazo,
        prioridade: 2,
      })
    }

    if (disputaEmAberto) {
      pendencias.push({
        ...base,
        titulo: 'Disputa em aberto',
        motivo: disputaEmAberto.descricao,
        responsavel: daContratante,
        prioridade: 3,
      })
    }

    if (resumo.medicoesPendentesDeposito > 0) {
      pendencias.push({
        ...base,
        titulo: `${resumo.medicoesPendentesDeposito} medição(ões) sem depósito confirmado`,
        motivo: 'Confirme o depósito para que a retenção entre na base de rendimento.',
        responsavel: daContratante,
        prioridade: 4,
      })
    }

    for (const doc of documentos.filter((d) => d.status === 'pendente' || d.status === 'rejeitado')) {
      pendencias.push({
        ...base,
        titulo:
          doc.status === 'rejeitado'
            ? `Aguardando reenvio: ${doc.nome}`
            : `Aguardando envio: ${doc.nome}`,
        motivo:
          doc.status === 'rejeitado'
            ? `Recusado em ${formatarData(doc.analisadoEm)} por ${doc.analisadoPor ?? '—'}. Motivo: ${doc.motivoRejeicao ?? '—'}`
            : 'Documento obrigatório ainda não enviado pela contratada.',
        responsavel: daContratada,
        prazo: doc.prazo,
        prioridade: 5,
      })
    }

    if (avaliacao.status === 'elegivel') {
      pendencias.push({
        ...base,
        titulo: 'Contrato elegível para liberação',
        motivo: 'Todas as condições foram cumpridas. Aguardando a solicitação da contratada.',
        responsavel: daContratada,
        prioridade: 6,
      })
    }
  }

  return pendencias.sort((a, b) => a.prioridade - b.prioridade)
}

/** Pendências do lado da contratada: o que falta para receber. */
export function listarPendenciasContratada(estado: EstadoDemo, contratadaId: string): Pendencia[] {
  const pendencias: Pendencia[] = []

  for (const detalhe of detalharTodos(estado)) {
    const { contrato, avaliacao, documentos, contratante, contratada } = detalhe
    if (contrato.contratadaId !== contratadaId) continue
    if (contrato.liberadoEm) continue
    const base = {
      contratoId: contrato.id,
      codigo: contrato.codigo,
      nomeContrato: contrato.nome,
      empresa: contratante?.nome ?? '—',
    }
    const daContratante = contratante?.contato ?? 'Contratante'
    const daContratada = contratada?.contato ?? 'Contratada'

    for (const doc of documentos.filter((d) => d.status === 'rejeitado')) {
      pendencias.push({
        ...base,
        titulo: `Reenviar documento: ${doc.nome}`,
        motivo: `Recusado em ${formatarData(doc.analisadoEm)} por ${doc.analisadoPor ?? '—'}. Motivo: ${doc.motivoRejeicao ?? '—'}`,
        responsavel: daContratada,
        prazo: doc.prazo,
        prioridade: 1,
      })
    }

    for (const doc of documentos.filter((d) => d.status === 'pendente')) {
      pendencias.push({
        ...base,
        titulo: `Enviar documento: ${doc.nome}`,
        motivo: doc.obrigatorio
          ? 'Documento obrigatório para a liberação da retenção.'
          : 'Documento complementar.',
        responsavel: daContratada,
        prazo: doc.prazo,
        prioridade: 2,
      })
    }

    for (const doc of documentos.filter((d) => d.status === 'enviado')) {
      pendencias.push({
        ...base,
        titulo: `Em análise: ${doc.nome}`,
        motivo: doc.recebidoEm
          ? `Recebimento confirmado em ${formatarData(doc.recebidoEm)} por ${doc.recebidoPor ?? '—'}. Aguardando decisão.`
          : 'Enviado. Aguardando a confirmação de recebimento pela contratante.',
        responsavel: daContratante,
        prazo: doc.prazo,
        prioridade: 3,
      })
    }

    if (avaliacao.status === 'elegivel') {
      pendencias.push({
        ...base,
        titulo: 'Pronto para solicitar a liberação',
        motivo: 'Todas as condições foram cumpridas.',
        responsavel: daContratada,
        prioridade: 4,
      })
    } else if (avaliacao.status === 'solicitada') {
      pendencias.push({
        ...base,
        titulo: 'Liberação solicitada',
        motivo: 'Aguardando a confirmação da contratante.',
        responsavel: daContratante,
        prioridade: 4,
      })
    } else {
      for (const p of avaliacao.pendencias) {
        // Documentos já foram detalhados acima, item a item.
        if (p.chave === 'documentos') continue
        pendencias.push({
          ...base,
          titulo: p.titulo,
          motivo: p.detalhe,
          responsavel:
            p.responsavelPapel === 'prazo'
              ? 'Prazo contratual'
              : p.responsavelPapel === 'contratante'
                ? daContratante
                : daContratada,
          prazo: p.prazo,
          prioridade: 5,
        })
      }
    }
  }

  return pendencias.sort((a, b) => a.prioridade - b.prioridade)
}

export interface AssinaturaContratante {
  contratante: Empresa
  plano: Plano | undefined
  planoIndicado: Plano
  contratosComRetencaoAtiva: number
  excedido: boolean
  mensalidadeCents: number
  aPartirDe: boolean
}

export function listarAssinaturas(estado: EstadoDemo): AssinaturaContratante[] {
  return estado.contratantes.map((contratante) => {
    const ativos = contratosComRetencaoAtiva(estado, contratante.id)
    const plano = acharPlano(contratante.planoId)
    return {
      contratante,
      plano,
      planoIndicado: planoIndicado(ativos),
      contratosComRetencaoAtiva: ativos,
      excedido: planoExcedido(plano, ativos),
      mensalidadeCents: plano?.precoMensalCents ?? 0,
      aPartirDe: plano?.aPartirDe ?? false,
    }
  })
}

export interface TotaisPlataforma {
  contratantes: number
  contratosAdministrados: number
  contratosComModuloFinanceiro: number
  recursosRetidosCents: number
  receitaAssinaturasMensalCents: number
  /** True se alguma assinatura for do tipo "a partir de", tornando o total um piso. */
  receitaAssinaturasEhPiso: boolean
  receitaParticipacaoAcumuladaCents: number
  receitaParticipacaoMesCorrenteCents: number
  rendimentoBrutoAcumuladoCents: number
  contratosLiberados: number
  totalLiberadoCents: number
}

export function calcularTotaisPlataforma(estado: EstadoDemo, periodoCorrente: string): TotaisPlataforma {
  const detalhados = detalharTodos(estado)
  const assinaturas = listarAssinaturas(estado)

  return {
    contratantes: estado.contratantes.length,
    contratosAdministrados: estado.contratos.length,
    contratosComModuloFinanceiro: detalhados.filter((d) => d.contrato.moduloFinanceiroAtivo).length,
    recursosRetidosCents: detalhados.reduce((s, d) => s + d.resumo.saldoParaLiberacaoCents, 0),
    receitaAssinaturasMensalCents: assinaturas.reduce((s, a) => s + a.mensalidadeCents, 0),
    receitaAssinaturasEhPiso: assinaturas.some((a) => a.aPartirDe),
    receitaParticipacaoAcumuladaCents: estado.rendimentos.reduce(
      (s, r) => s + r.receitaPlataformaCents,
      0,
    ),
    receitaParticipacaoMesCorrenteCents: estado.rendimentos
      .filter((r) => r.periodo === periodoCorrente)
      .reduce((s, r) => s + r.receitaPlataformaCents, 0),
    rendimentoBrutoAcumuladoCents: estado.rendimentos.reduce((s, r) => s + r.rendimentoBrutoCents, 0),
    contratosLiberados: detalhados.filter((d) => d.contrato.liberadoEm).length,
    totalLiberadoCents: detalhados.reduce((s, d) => s + d.resumo.totalLiberadoCents, 0),
  }
}
