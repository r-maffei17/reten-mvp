// Consultas derivadas do estado, usadas pelas telas. Camada pura.

import { calcularResumoContrato, disputaAberta, type ResumoContrato } from './calculos'
import { avaliarLiberacaoDoEstado, type AvaliacaoLiberacao } from './elegibilidade'
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

export interface Pendencia {
  contratoId: string
  codigo: string
  nomeContrato: string
  empresa: string
  titulo: string
  detalhe: string
  prioridade: number
}

/** Pendências priorizadas para o painel da contratante. */
export function listarPendenciasContratante(estado: EstadoDemo): Pendencia[] {
  const pendencias: Pendencia[] = []

  for (const detalhe of detalharTodos(estado)) {
    const { contrato, resumo, avaliacao, disputaEmAberto, documentos, contratada } = detalhe
    if (contrato.liberadoEm) continue
    const empresa = contratada?.nome ?? '—'
    const base = {
      contratoId: contrato.id,
      codigo: contrato.codigo,
      nomeContrato: contrato.nome,
      empresa,
    }

    if (contrato.liberacaoSolicitadaEm && avaliacao.status === 'solicitada') {
      pendencias.push({
        ...base,
        titulo: 'Liberação solicitada',
        detalhe: 'A contratada solicitou a liberação. Revise as condições e confirme.',
        prioridade: 1,
      })
    }

    const enviados = documentos.filter((d) => d.status === 'enviado')
    if (enviados.length > 0) {
      pendencias.push({
        ...base,
        titulo: `${enviados.length} documento(s) aguardando análise`,
        detalhe: enviados.map((d) => d.nome).join(', '),
        prioridade: 2,
      })
    }

    if (disputaEmAberto) {
      pendencias.push({
        ...base,
        titulo: 'Disputa em aberto',
        detalhe: disputaEmAberto.descricao,
        prioridade: 3,
      })
    }

    if (resumo.medicoesPendentesDeposito > 0) {
      pendencias.push({
        ...base,
        titulo: `${resumo.medicoesPendentesDeposito} medição(ões) sem depósito confirmado`,
        detalhe: 'Confirme o depósito simulado para que a retenção entre no saldo aplicado.',
        prioridade: 4,
      })
    }

    if (avaliacao.status === 'elegivel') {
      pendencias.push({
        ...base,
        titulo: 'Contrato elegível para liberação',
        detalhe: 'Todas as condições foram cumpridas. Aguardando a solicitação da contratada.',
        prioridade: 5,
      })
    }
  }

  return pendencias.sort((a, b) => a.prioridade - b.prioridade)
}

/** Pendências do lado da contratada: o que falta para receber. */
export function listarPendenciasContratada(estado: EstadoDemo, contratadaId: string): Pendencia[] {
  const pendencias: Pendencia[] = []

  for (const detalhe of detalharTodos(estado)) {
    const { contrato, avaliacao, documentos, contratante } = detalhe
    if (contrato.contratadaId !== contratadaId) continue
    if (contrato.liberadoEm) continue
    const base = {
      contratoId: contrato.id,
      codigo: contrato.codigo,
      nomeContrato: contrato.nome,
      empresa: contratante?.nome ?? '—',
    }

    const rejeitados = documentos.filter((d) => d.status === 'rejeitado')
    for (const doc of rejeitados) {
      pendencias.push({
        ...base,
        titulo: `Documento rejeitado: ${doc.nome}`,
        detalhe: doc.motivoRejeicao ?? 'Reenvie o documento corrigido.',
        prioridade: 1,
      })
    }

    const aEnviar = documentos.filter((d) => d.status === 'pendente')
    for (const doc of aEnviar) {
      pendencias.push({
        ...base,
        titulo: `Documento a enviar: ${doc.nome}`,
        detalhe: doc.obrigatorio ? 'Obrigatório para a liberação.' : 'Documento complementar.',
        prioridade: 2,
      })
    }

    if (avaliacao.status === 'elegivel') {
      pendencias.push({
        ...base,
        titulo: 'Pronto para solicitar a liberação',
        detalhe: 'Todas as condições foram cumpridas.',
        prioridade: 3,
      })
    } else if (avaliacao.status === 'solicitada') {
      pendencias.push({
        ...base,
        titulo: 'Liberação solicitada',
        detalhe: 'Aguardando a confirmação da contratante.',
        prioridade: 3,
      })
    } else {
      for (const p of avaliacao.pendencias) {
        // Documentos já foram detalhados acima, item a item.
        if (p.chave === 'documentos') continue
        pendencias.push({ ...base, titulo: p.titulo, detalhe: p.detalhe, prioridade: 4 })
      }
    }
  }

  return pendencias.sort((a, b) => a.prioridade - b.prioridade)
}

export interface TotaisPlataforma {
  contratantes: number
  contratosAdministrados: number
  recursosRetidosCents: number
  receitaAssinaturasMensalCents: number
  receitaParticipacaoAcumuladaCents: number
  receitaParticipacaoMesCorrenteCents: number
  rendimentoBrutoAcumuladoCents: number
  contratosLiberados: number
  totalLiberadoCents: number
}

export function calcularTotaisPlataforma(estado: EstadoDemo, periodoCorrente: string): TotaisPlataforma {
  const detalhados = detalharTodos(estado)
  const recursosRetidosCents = detalhados.reduce((s, d) => s + d.resumo.saldoParaLiberacaoCents, 0)
  const receitaParticipacaoAcumuladaCents = estado.rendimentos.reduce(
    (s, r) => s + r.receitaPlataformaCents,
    0,
  )
  const receitaParticipacaoMesCorrenteCents = estado.rendimentos
    .filter((r) => r.periodo === periodoCorrente)
    .reduce((s, r) => s + r.receitaPlataformaCents, 0)

  return {
    contratantes: estado.contratantes.length,
    contratosAdministrados: estado.contratos.length,
    recursosRetidosCents,
    receitaAssinaturasMensalCents: estado.contratantes.length * estado.configuracoes.mensalidadeCents,
    receitaParticipacaoAcumuladaCents,
    receitaParticipacaoMesCorrenteCents,
    rendimentoBrutoAcumuladoCents: estado.rendimentos.reduce((s, r) => s + r.rendimentoBrutoCents, 0),
    contratosLiberados: detalhados.filter((d) => d.contrato.liberadoEm).length,
    totalLiberadoCents: detalhados.reduce((s, d) => s + d.resumo.totalLiberadoCents, 0),
  }
}
