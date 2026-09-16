// Ações da demonstração: funções puras que recebem o estado e devolvem um novo estado.
// Nenhuma delas conhece React. Toda regra de bloqueio vive aqui e é revalidada no momento da ação.

import { calcularRendimento, calcularResumoContrato, disputaAberta } from './calculos'
import { formatarData, hojeISO, periodoAtual, proximoPeriodo } from './datas'
import { avaliarLiberacaoDoEstado } from './elegibilidade'
import { formatarMoeda } from './money'
import type {
  Configuracoes,
  Contrato,
  Disputa,
  Documento,
  EstadoDemo,
  EventoHistorico,
  Medicao,
  Perfil,
  TipoEvento,
} from './types'

export type ResultadoAcao =
  | { ok: true; estado: EstadoDemo; mensagem: string }
  | { ok: false; mensagem: string }

let contadorId = 0
function novoId(prefixo: string): string {
  contadorId += 1
  return `${prefixo}-${Date.now().toString(36)}-${contadorId.toString(36)}`
}

function agora(): string {
  return new Date().toISOString()
}

function registrar(
  estado: EstadoDemo,
  contratoId: string,
  tipo: TipoEvento,
  descricao: string,
  perfil: Perfil,
): EventoHistorico[] {
  const evento: EventoHistorico = {
    id: novoId('h'),
    contratoId,
    tipo,
    descricao,
    perfil,
    data: agora(),
  }
  return [evento, ...estado.historico]
}

function acharContrato(estado: EstadoDemo, contratoId: string): Contrato | undefined {
  return estado.contratos.find((c) => c.id === contratoId)
}

/** Contratos liberados ficam congelados: nenhuma nova movimentação é aceita. */
function bloqueioPorLiberacao(contrato: Contrato): string | null {
  return contrato.liberadoEm
    ? `O contrato ${contrato.codigo} já foi liberado em ${formatarData(contrato.liberadoEm)} e não aceita novas movimentações.`
    : null
}

// ---------------------------------------------------------------- contratos

export interface NovoContrato {
  nome: string
  codigo: string
  contratanteId: string
  contratadaId: string
  valorTotalCents: number
  percentualRetencao: number
  dataInicio: string
  dataTermino: string
  dataMinimaLiberacao: string
  condicoesLiberacao: string
}

export function criarContrato(estado: EstadoDemo, dados: NovoContrato): ResultadoAcao {
  const contrato: Contrato = {
    id: novoId('c'),
    codigo: dados.codigo.trim(),
    nome: dados.nome.trim(),
    contratanteId: dados.contratanteId,
    contratadaId: dados.contratadaId,
    valorTotalCents: dados.valorTotalCents,
    percentualRetencao: dados.percentualRetencao,
    dataInicio: dados.dataInicio,
    dataTermino: dados.dataTermino,
    dataMinimaLiberacao: dados.dataMinimaLiberacao,
    condicoesLiberacao: dados.condicoesLiberacao.trim(),
    entregaAceita: false,
    criadoEm: agora(),
  }
  const comContrato: EstadoDemo = { ...estado, contratos: [...estado.contratos, contrato] }
  return {
    ok: true,
    estado: {
      ...comContrato,
      historico: registrar(
        comContrato,
        contrato.id,
        'contrato_criado',
        `Contrato ${contrato.codigo} cadastrado com retenção de ${contrato.percentualRetencao}%.`,
        'contratante',
      ),
    },
    mensagem: `Contrato ${contrato.codigo} cadastrado com sucesso.`,
  }
}

// ---------------------------------------------------------------- medições

export function registrarMedicao(
  estado: EstadoDemo,
  contratoId: string,
  dados: { descricao: string; data: string; valorCents: number },
): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const resumo = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  if (dados.valorCents > resumo.saldoAMedirCents) {
    return {
      ok: false,
      mensagem: `A soma das medições não pode ultrapassar o valor do contrato. Disponível para medir: ${formatarMoeda(resumo.saldoAMedirCents)}.`,
    }
  }

  const retencaoCents = Math.round((dados.valorCents * contrato.percentualRetencao) / 100)
  const medicao: Medicao = {
    id: novoId('m'),
    contratoId,
    descricao: dados.descricao.trim(),
    data: dados.data,
    valorCents: dados.valorCents,
    retencaoCents,
    depositoConfirmado: false,
  }
  const comMedicao: EstadoDemo = { ...estado, medicoes: [...estado.medicoes, medicao] }
  return {
    ok: true,
    estado: {
      ...comMedicao,
      historico: registrar(
        comMedicao,
        contratoId,
        'medicao_registrada',
        `Medição "${medicao.descricao}" registrada: ${formatarMoeda(medicao.valorCents)} com retenção de ${formatarMoeda(retencaoCents)}.`,
        'contratante',
      ),
    },
    mensagem: `Medição registrada. Retenção calculada: ${formatarMoeda(retencaoCents)}.`,
  }
}

export function confirmarDeposito(estado: EstadoDemo, medicaoId: string): ResultadoAcao {
  const medicao = estado.medicoes.find((m) => m.id === medicaoId)
  if (!medicao) return { ok: false, mensagem: 'Medição não encontrada.' }
  if (medicao.depositoConfirmado)
    return { ok: false, mensagem: 'O depósito desta medição já estava confirmado.' }

  const contrato = acharContrato(estado, medicao.contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const medicoes = estado.medicoes.map((m) =>
    m.id === medicaoId ? { ...m, depositoConfirmado: true, depositoConfirmadoEm: hojeISO() } : m,
  )
  const novo: EstadoDemo = { ...estado, medicoes }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        medicao.contratoId,
        'deposito_confirmado',
        `Depósito simulado de ${formatarMoeda(medicao.retencaoCents)} confirmado para a medição "${medicao.descricao}".`,
        'contratante',
      ),
    },
    mensagem: `Depósito simulado de ${formatarMoeda(medicao.retencaoCents)} confirmado.`,
  }
}

// ---------------------------------------------------------------- documentos

function nomeArquivoFicticio(nomeDocumento: string): string {
  const base = nomeDocumento
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base}-${hojeISO().replace(/-/g, '')}.pdf`
}

export function enviarDocumento(estado: EstadoDemo, documentoId: string): ResultadoAcao {
  const documento = estado.documentos.find((d) => d.id === documentoId)
  if (!documento) return { ok: false, mensagem: 'Documento não encontrado.' }
  if (documento.status === 'aprovado')
    return { ok: false, mensagem: 'Este documento já foi aprovado.' }
  if (documento.status === 'enviado')
    return { ok: false, mensagem: 'Este documento já foi enviado e aguarda análise.' }

  const contrato = acharContrato(estado, documento.contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const reenvio = documento.status === 'rejeitado'
  const arquivoNome = nomeArquivoFicticio(documento.nome)
  const documentos = estado.documentos.map((d) =>
    d.id === documentoId
      ? {
          ...d,
          status: 'enviado' as const,
          arquivoNome,
          enviadoEm: hojeISO(),
          analisadoEm: undefined,
          // A justificativa anterior é preservada no histórico, mas sai do estado atual.
          motivoRejeicao: undefined,
        }
      : d,
  )
  const novo: EstadoDemo = { ...estado, documentos }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        documento.contratoId,
        'documento_enviado',
        `${reenvio ? 'Reenvio' : 'Envio'} simulado do documento "${documento.nome}" (${arquivoNome}).`,
        'contratada',
      ),
    },
    mensagem: `${reenvio ? 'Reenvio' : 'Envio'} simulado concluído: ${arquivoNome}.`,
  }
}

export function aprovarDocumento(estado: EstadoDemo, documentoId: string): ResultadoAcao {
  const documento = estado.documentos.find((d) => d.id === documentoId)
  if (!documento) return { ok: false, mensagem: 'Documento não encontrado.' }
  if (documento.status !== 'enviado')
    return { ok: false, mensagem: 'Somente documentos enviados podem ser aprovados.' }

  const contrato = acharContrato(estado, documento.contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const documentos = estado.documentos.map((d) =>
    d.id === documentoId
      ? { ...d, status: 'aprovado' as const, analisadoEm: hojeISO(), motivoRejeicao: undefined }
      : d,
  )
  const novo: EstadoDemo = { ...estado, documentos }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        documento.contratoId,
        'documento_aprovado',
        `Documento "${documento.nome}" aprovado pela contratante.`,
        'contratante',
      ),
    },
    mensagem: `Documento "${documento.nome}" aprovado.`,
  }
}

export function rejeitarDocumento(
  estado: EstadoDemo,
  documentoId: string,
  motivo: string,
): ResultadoAcao {
  const documento = estado.documentos.find((d) => d.id === documentoId)
  if (!documento) return { ok: false, mensagem: 'Documento não encontrado.' }
  if (documento.status !== 'enviado')
    return { ok: false, mensagem: 'Somente documentos enviados podem ser rejeitados.' }
  if (!motivo.trim())
    return { ok: false, mensagem: 'A justificativa é obrigatória para rejeitar um documento.' }

  const contrato = acharContrato(estado, documento.contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const documentos = estado.documentos.map((d) =>
    d.id === documentoId
      ? {
          ...d,
          status: 'rejeitado' as const,
          analisadoEm: hojeISO(),
          motivoRejeicao: motivo.trim(),
        }
      : d,
  )
  const novo: EstadoDemo = { ...estado, documentos }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        documento.contratoId,
        'documento_rejeitado',
        `Documento "${documento.nome}" rejeitado. Justificativa: ${motivo.trim()}`,
        'contratante',
      ),
    },
    mensagem: `Documento "${documento.nome}" rejeitado. A contratada poderá reenviar.`,
  }
}

// ---------------------------------------------------------------- entrega e disputas

export function aceitarEntrega(estado: EstadoDemo, contratoId: string): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  if (contrato.entregaAceita) return { ok: false, mensagem: 'O aceite da entrega já foi registrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const contratos = estado.contratos.map((c) =>
    c.id === contratoId ? { ...c, entregaAceita: true, entregaAceitaEm: hojeISO() } : c,
  )
  const novo: EstadoDemo = { ...estado, contratos }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        contratoId,
        'entrega_aceita',
        'Aceite da entrega registrado pela contratante.',
        'contratante',
      ),
    },
    mensagem: 'Aceite da entrega registrado.',
  }
}

export function abrirDisputa(
  estado: EstadoDemo,
  contratoId: string,
  descricao: string,
): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }
  if (disputaAberta(estado.disputas, contratoId))
    return { ok: false, mensagem: 'Já existe uma disputa em aberto neste contrato.' }
  if (!descricao.trim()) return { ok: false, mensagem: 'Descreva o motivo da disputa.' }

  const disputa: Disputa = {
    id: novoId('dp'),
    contratoId,
    descricao: descricao.trim(),
    abertaEm: hojeISO(),
    status: 'aberta',
  }
  const novo: EstadoDemo = { ...estado, disputas: [...estado.disputas, disputa] }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        contratoId,
        'disputa_aberta',
        `Disputa registrada: ${disputa.descricao}`,
        'contratante',
      ),
    },
    mensagem: 'Disputa registrada. A liberação fica bloqueada enquanto ela estiver em aberto.',
  }
}

export function resolverDisputa(
  estado: EstadoDemo,
  disputaId: string,
  resolucao: string,
): ResultadoAcao {
  const disputa = estado.disputas.find((d) => d.id === disputaId)
  if (!disputa) return { ok: false, mensagem: 'Disputa não encontrada.' }
  if (disputa.status === 'resolvida') return { ok: false, mensagem: 'Esta disputa já foi resolvida.' }
  if (!resolucao.trim()) return { ok: false, mensagem: 'Descreva como a disputa foi resolvida.' }

  const disputas = estado.disputas.map((d) =>
    d.id === disputaId
      ? { ...d, status: 'resolvida' as const, resolucao: resolucao.trim(), resolvidaEm: hojeISO() }
      : d,
  )
  const novo: EstadoDemo = { ...estado, disputas }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        disputa.contratoId,
        'disputa_resolvida',
        `Disputa resolvida. Registro: ${resolucao.trim()}`,
        'contratante',
      ),
    },
    mensagem: 'Disputa resolvida.',
  }
}

// ---------------------------------------------------------------- rendimentos

export function simularProximoMes(estado: EstadoDemo, contratoId: string): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  if (contrato.liberadoEm)
    return {
      ok: false,
      mensagem: 'Contrato já liberado: não há mais rendimentos a simular.',
    }

  const resumo = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  if (resumo.principalElegivelRendimentoCents <= 0) {
    return {
      ok: false,
      mensagem:
        'Não há principal depositado neste contrato. Confirme o depósito simulado de uma retenção antes de simular o rendimento.',
    }
  }

  const periodo = resumo.ultimoPeriodoRendimento
    ? proximoPeriodo(resumo.ultimoPeriodoRendimento)
    : periodoAtual()

  if (estado.rendimentos.some((r) => r.contratoId === contratoId && r.periodo === periodo)) {
    return { ok: false, mensagem: `Já existe um lançamento para o período ${periodo}.` }
  }

  const calculo = calcularRendimento(
    resumo.principalElegivelRendimentoCents,
    estado.configuracoes.taxaMensalPercentual,
    estado.configuracoes.participacaoPercentual,
  )

  const lancamento = {
    id: novoId('r'),
    contratoId,
    periodo,
    principalBaseCents: calculo.principalBaseCents,
    taxaMensalPercentual: estado.configuracoes.taxaMensalPercentual,
    participacaoPercentual: estado.configuracoes.participacaoPercentual,
    rendimentoBrutoCents: calculo.rendimentoBrutoCents,
    receitaPlataformaCents: calculo.receitaPlataformaCents,
    rendimentoContratadaCents: calculo.rendimentoContratadaCents,
    criadoEm: agora(),
  }

  const novo: EstadoDemo = { ...estado, rendimentos: [...estado.rendimentos, lancamento] }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        contratoId,
        'rendimento_simulado',
        `Rendimento simulado do período ${periodo}: bruto de ${formatarMoeda(calculo.rendimentoBrutoCents)} sobre ${formatarMoeda(calculo.principalBaseCents)} — ${formatarMoeda(calculo.rendimentoContratadaCents)} para a contratada e ${formatarMoeda(calculo.receitaPlataformaCents)} para a plataforma.`,
        'plataforma',
      ),
    },
    mensagem: `Rendimento de ${periodo} lançado: ${formatarMoeda(calculo.rendimentoContratadaCents)} para a contratada.`,
  }
}

// ---------------------------------------------------------------- liberação

export function solicitarLiberacao(estado: EstadoDemo, contratoId: string): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  if (contrato.liberadoEm)
    return { ok: false, mensagem: 'Este contrato já foi liberado. Não é possível solicitar novamente.' }
  if (contrato.liberacaoSolicitadaEm)
    return { ok: false, mensagem: 'Já existe uma solicitação de liberação em andamento.' }

  const avaliacao = avaliarLiberacaoDoEstado(estado, contrato)
  if (!avaliacao.todasCumpridas) {
    return {
      ok: false,
      mensagem: `Liberação bloqueada. Pendências: ${avaliacao.pendencias.map((p) => p.titulo).join('; ')}.`,
    }
  }

  const contratos = estado.contratos.map((c) =>
    c.id === contratoId ? { ...c, liberacaoSolicitadaEm: hojeISO() } : c,
  )
  const novo: EstadoDemo = { ...estado, contratos }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        contratoId,
        'liberacao_solicitada',
        `Liberação solicitada pela contratada. Saldo apurado: ${formatarMoeda(avaliacao.saldoParaLiberacaoCents)}.`,
        'contratada',
      ),
    },
    mensagem: 'Solicitação de liberação enviada à contratante.',
  }
}

export function confirmarLiberacao(estado: EstadoDemo, contratoId: string): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  if (contrato.liberadoEm)
    return { ok: false, mensagem: 'Este contrato já foi liberado. Liberação duplicada não é permitida.' }
  if (!contrato.liberacaoSolicitadaEm)
    return { ok: false, mensagem: 'A contratada ainda não solicitou a liberação deste contrato.' }

  // Revalidação obrigatória no momento da confirmação.
  const avaliacao = avaliarLiberacaoDoEstado(estado, contrato)
  const pendenciasReais = avaliacao.condicoes.filter((c) => !c.cumprida)
  if (pendenciasReais.length > 0) {
    return {
      ok: false,
      mensagem: `Liberação bloqueada na revalidação. Pendências: ${pendenciasReais.map((p) => p.titulo).join('; ')}.`,
    }
  }

  const resumo = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  const liberacao = {
    principalCents: resumo.principalRetidoCents,
    rendimentoContratadaCents: resumo.rendimentoRetidoCents,
    totalCents: resumo.saldoParaLiberacaoCents,
  }

  const contratos = estado.contratos.map((c) =>
    c.id === contratoId ? { ...c, liberadoEm: hojeISO(), liberacao } : c,
  )
  const novo: EstadoDemo = { ...estado, contratos }
  return {
    ok: true,
    estado: {
      ...novo,
      historico: registrar(
        novo,
        contratoId,
        'liberacao_confirmada',
        `Liberação simulada confirmada: ${formatarMoeda(liberacao.totalCents)} (principal de ${formatarMoeda(liberacao.principalCents)} + rendimentos de ${formatarMoeda(liberacao.rendimentoContratadaCents)}).`,
        'contratante',
      ),
    },
    mensagem: `Liberação simulada de ${formatarMoeda(liberacao.totalCents)} confirmada.`,
  }
}

// ---------------------------------------------------------------- configurações

export function salvarConfiguracoes(estado: EstadoDemo, config: Configuracoes): ResultadoAcao {
  // Alterações de taxa valem apenas para simulações futuras: os lançamentos já
  // registrados guardam a taxa aplicada na época e não são recalculados.
  return {
    ok: true,
    estado: { ...estado, configuracoes: { ...config } },
    mensagem: 'Parâmetros atualizados. Eles valem apenas para as próximas simulações.',
  }
}

export type { Documento }
