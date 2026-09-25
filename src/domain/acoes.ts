// Ações da demonstração: funções puras que recebem o estado e devolvem um novo estado.
// Nenhuma delas conhece React. Toda regra de bloqueio vive aqui e é revalidada no
// momento da ação. As datas gravadas usam a DATA DE SIMULAÇÃO do estado.

import { RESPONSAVEL_POR_PERFIL } from './atores'
import {
  calcularDataMinimaLiberacao,
  calcularRendimento,
  calcularResumoContrato,
  disputaAberta,
} from './calculos'
import { formatarData, proximoPeriodo } from './datas'
import { avaliarLiberacaoDoEstado } from './elegibilidade'
import { formatarMoeda } from './money'
import type {
  Configuracoes,
  Contrato,
  Disputa,
  EstadoDemo,
  EventoHistorico,
  IdPlano,
  Medicao,
  Perfil,
  TipoEvento,
  VersaoDocumento,
} from './types'

export type ResultadoAcao =
  | { ok: true; estado: EstadoDemo; mensagem: string }
  | { ok: false; mensagem: string }

let contadorId = 0
function novoId(prefixo: string): string {
  contadorId += 1
  return `${prefixo}-${Date.now().toString(36)}-${contadorId.toString(36)}`
}

/** Momento do registro, ancorado na data de simulação. */
function carimbo(estado: EstadoDemo): string {
  const agora = new Date()
  const hora = String(agora.getHours()).padStart(2, '0')
  const minuto = String(agora.getMinutes()).padStart(2, '0')
  return `${estado.dataSimulacao}T${hora}:${minuto}:00`
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
    autor: RESPONSAVEL_POR_PERFIL[perfil],
    data: carimbo(estado),
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

// ---------------------------------------------------------------- data de simulação

export function definirDataSimulacao(estado: EstadoDemo, data: string): ResultadoAcao {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { ok: false, mensagem: 'Informe uma data válida no formato dia/mês/ano.' }
  }
  return {
    ok: true,
    estado: { ...estado, dataSimulacao: data },
    mensagem: `Data da simulação ajustada para ${formatarData(data)}.`,
  }
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
  moduloFinanceiroAtivo: boolean
  dataConclusao?: string
  prazoDiasCorridos?: number
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
    moduloFinanceiroAtivo: dados.moduloFinanceiroAtivo,
    dataConclusao: dados.dataConclusao,
    prazoDiasCorridos: dados.prazoDiasCorridos,
    dataMinimaLiberacao: dados.dataMinimaLiberacao,
    condicoesLiberacao: dados.condicoesLiberacao.trim(),
    entregaAceita: false,
    criadoEm: carimbo(estado),
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
        `Contrato ${contrato.codigo} cadastrado com retenção de ${contrato.percentualRetencao}%${contrato.moduloFinanceiroAtivo ? ' e módulo financeiro ativo' : ', sem módulo financeiro'}.`,
        'contratante',
      ),
    },
    mensagem: `Contrato ${contrato.codigo} cadastrado com sucesso.`,
  }
}

// ---------------------------------------------------------------- importação de cauções (ERP)

export interface LinhaCaucao {
  contrato: string
  fornecedor: string
  valorMedidoCents: number
  percentual: number
  valorRetidoCents: number
  vencimento: string
}

/**
 * Cria um contrato por linha de caução importada do ERP.
 * Cada linha vira um contrato com uma medição já registrada no valor medido.
 * Fornecedores ainda não cadastrados são criados como contratadas convidadas.
 */
export function importarCaucoes(
  estado: EstadoDemo,
  linhas: LinhaCaucao[],
  opcoes: { contratanteId: string; moduloFinanceiroAtivo: boolean },
): ResultadoAcao {
  if (linhas.length === 0) return { ok: false, mensagem: 'Nenhuma linha válida para importar.' }

  const contratante = estado.contratantes.find((c) => c.id === opcoes.contratanteId)
  if (!contratante) return { ok: false, mensagem: 'Selecione a contratante da importação.' }

  const duplicados = linhas.filter((l) =>
    estado.contratos.some((c) => c.codigo.toLowerCase() === l.contrato.trim().toLowerCase()),
  )
  if (duplicados.length > 0) {
    return {
      ok: false,
      mensagem: `Já existe contrato com o código ${duplicados.map((d) => d.contrato).join(', ')}. Ajuste o arquivo antes de importar.`,
    }
  }

  let novo: EstadoDemo = { ...estado }
  const contratadas = [...estado.contratadas]
  const contratos = [...estado.contratos]
  const medicoes = [...estado.medicoes]
  let historico = [...estado.historico]

  for (const linha of linhas) {
    const nomeFornecedor = linha.fornecedor.trim()
    let contratada = contratadas.find(
      (c) => c.nome.toLowerCase() === nomeFornecedor.toLowerCase(),
    )
    if (!contratada) {
      contratada = {
        id: novoId('cd'),
        nome: nomeFornecedor,
        cnpj: '—',
        contato: 'Contato não informado no ERP',
      }
      contratadas.push(contratada)
    }

    const contrato: Contrato = {
      id: novoId('c'),
      codigo: linha.contrato.trim(),
      nome: `Caução importada — ${linha.contrato.trim()}`,
      contratanteId: contratante.id,
      contratadaId: contratada.id,
      valorTotalCents: linha.valorMedidoCents,
      percentualRetencao: linha.percentual,
      dataInicio: estado.dataSimulacao,
      dataTermino: linha.vencimento,
      moduloFinanceiroAtivo: opcoes.moduloFinanceiroAtivo,
      dataMinimaLiberacao: linha.vencimento,
      condicoesLiberacao:
        'Caução importada do ERP. Liberação após aceite da entrega, aprovação dos documentos obrigatórios e cumprimento do prazo.',
      entregaAceita: false,
      origem: 'erp',
      criadoEm: carimbo(estado),
    }
    contratos.push(contrato)

    medicoes.push({
      id: novoId('m'),
      contratoId: contrato.id,
      descricao: 'Medição importada do ERP',
      data: estado.dataSimulacao,
      valorCents: linha.valorMedidoCents,
      retencaoCents: linha.valorRetidoCents,
      // Sem módulo financeiro a retenção já compõe o saldo; com módulo, aguarda depósito.
      depositoConfirmado: false,
    })

    historico = [
      {
        id: novoId('h'),
        contratoId: contrato.id,
        tipo: 'contrato_importado' as TipoEvento,
        descricao: `Caução importada do ERP: ${formatarMoeda(linha.valorMedidoCents)} medidos, ${linha.percentual}% retidos (${formatarMoeda(linha.valorRetidoCents)}), vencimento em ${formatarData(linha.vencimento)}.`,
        perfil: 'contratante' as Perfil,
        autor: RESPONSAVEL_POR_PERFIL.contratante,
        data: carimbo(estado),
      },
      ...historico,
    ]
  }

  novo = { ...novo, contratadas, contratos, medicoes, historico }
  return {
    ok: true,
    estado: novo,
    mensagem: `${linhas.length} caução(ões) importada(s) do ERP.`,
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
  if (!contrato.moduloFinanceiroAtivo) {
    return {
      ok: false,
      mensagem:
        'Este contrato não tem módulo financeiro. A retenção já compõe o saldo retido, sem etapa de depósito.',
    }
  }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const medicoes = estado.medicoes.map((m) =>
    m.id === medicaoId
      ? { ...m, depositoConfirmado: true, depositoConfirmadoEm: estado.dataSimulacao }
      : m,
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
        `Depósito de ${formatarMoeda(medicao.retencaoCents)} confirmado para a medição "${medicao.descricao}".`,
        'contratante',
      ),
    },
    mensagem: `Depósito de ${formatarMoeda(medicao.retencaoCents)} confirmado.`,
  }
}

// ---------------------------------------------------------------- documentos

function nomeArquivoFicticio(nomeDocumento: string, versao: number, data: string): string {
  const base = nomeDocumento
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base}-v${versao}-${data.replace(/-/g, '')}.pdf`
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
  const versao = documento.versaoAtual + 1
  const enviadoPor = RESPONSAVEL_POR_PERFIL.contratada
  const arquivoNome = nomeArquivoFicticio(documento.nome, versao, estado.dataSimulacao)

  const novaVersao: VersaoDocumento = {
    versao,
    arquivoNome,
    enviadoEm: estado.dataSimulacao,
    enviadoPor,
    resultado: 'em_analise',
  }

  const documentos = estado.documentos.map((d) =>
    d.id === documentoId
      ? {
          ...d,
          status: 'enviado' as const,
          arquivoNome,
          enviadoEm: estado.dataSimulacao,
          enviadoPor,
          // A análise e o recebimento voltam a zero para esta nova versão.
          recebidoEm: undefined,
          recebidoPor: undefined,
          analisadoEm: undefined,
          analisadoPor: undefined,
          motivoRejeicao: undefined,
          versaoAtual: versao,
          versoes: [...d.versoes, novaVersao],
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
        `${reenvio ? 'Reenvio' : 'Envio'} do documento "${documento.nome}" (versão ${versao}, ${arquivoNome}).`,
        'contratada',
      ),
    },
    mensagem: `${reenvio ? 'Reenvio' : 'Envio'} concluído: versão ${versao} (${arquivoNome}).`,
  }
}

export function confirmarRecebimento(estado: EstadoDemo, documentoId: string): ResultadoAcao {
  const documento = estado.documentos.find((d) => d.id === documentoId)
  if (!documento) return { ok: false, mensagem: 'Documento não encontrado.' }
  if (documento.status !== 'enviado')
    return { ok: false, mensagem: 'Só é possível confirmar o recebimento de um documento enviado.' }
  if (documento.recebidoEm)
    return { ok: false, mensagem: 'O recebimento desta versão já foi confirmado.' }

  const recebidoPor = RESPONSAVEL_POR_PERFIL.contratante
  const documentos = estado.documentos.map((d) =>
    d.id === documentoId
      ? {
          ...d,
          recebidoEm: estado.dataSimulacao,
          recebidoPor,
          versoes: d.versoes.map((v) =>
            v.versao === d.versaoAtual
              ? { ...v, recebidoEm: estado.dataSimulacao, recebidoPor }
              : v,
          ),
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
        'documento_recebido',
        `Recebimento da versão ${documento.versaoAtual} do documento "${documento.nome}" confirmado.`,
        'contratante',
      ),
    },
    mensagem: `Recebimento confirmado. A contratada passa a ver a data e o responsável pela análise.`,
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

  const analisadoPor = RESPONSAVEL_POR_PERFIL.contratante
  const documentos = estado.documentos.map((d) =>
    d.id === documentoId
      ? {
          ...d,
          status: 'aprovado' as const,
          // Aprovar implica ter recebido: o carimbo é preenchido se ainda faltava.
          recebidoEm: d.recebidoEm ?? estado.dataSimulacao,
          recebidoPor: d.recebidoPor ?? analisadoPor,
          analisadoEm: estado.dataSimulacao,
          analisadoPor,
          motivoRejeicao: undefined,
          versoes: d.versoes.map((v) =>
            v.versao === d.versaoAtual
              ? {
                  ...v,
                  resultado: 'aprovado' as const,
                  recebidoEm: v.recebidoEm ?? estado.dataSimulacao,
                  recebidoPor: v.recebidoPor ?? analisadoPor,
                  analisadoEm: estado.dataSimulacao,
                  analisadoPor,
                }
              : v,
          ),
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
        'documento_aprovado',
        `Documento "${documento.nome}" (versão ${documento.versaoAtual}) aprovado.`,
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
    return { ok: false, mensagem: 'O motivo da recusa é obrigatório para rejeitar um documento.' }

  const contrato = acharContrato(estado, documento.contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const analisadoPor = RESPONSAVEL_POR_PERFIL.contratante
  const documentos = estado.documentos.map((d) =>
    d.id === documentoId
      ? {
          ...d,
          status: 'rejeitado' as const,
          recebidoEm: d.recebidoEm ?? estado.dataSimulacao,
          recebidoPor: d.recebidoPor ?? analisadoPor,
          analisadoEm: estado.dataSimulacao,
          analisadoPor,
          motivoRejeicao: motivo.trim(),
          versoes: d.versoes.map((v) =>
            v.versao === d.versaoAtual
              ? {
                  ...v,
                  resultado: 'rejeitado' as const,
                  recebidoEm: v.recebidoEm ?? estado.dataSimulacao,
                  recebidoPor: v.recebidoPor ?? analisadoPor,
                  analisadoEm: estado.dataSimulacao,
                  analisadoPor,
                  motivoRejeicao: motivo.trim(),
                }
              : v,
          ),
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
        `Documento "${documento.nome}" (versão ${documento.versaoAtual}) recusado. Motivo: ${motivo.trim()}`,
        'contratante',
      ),
    },
    mensagem: `Documento "${documento.nome}" recusado. A contratada verá o motivo e poderá reenviar.`,
  }
}

// ---------------------------------------------------------------- entrega e disputas

export function aceitarEntrega(estado: EstadoDemo, contratoId: string): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  if (contrato.entregaAceita) return { ok: false, mensagem: 'O aceite da entrega já foi registrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }

  const por = RESPONSAVEL_POR_PERFIL.contratante
  const contratos = estado.contratos.map((c) =>
    c.id === contratoId
      ? {
          ...c,
          entregaAceita: true,
          entregaAceitaEm: estado.dataSimulacao,
          entregaAceitaPor: por,
          dataConclusao: c.dataConclusao ?? estado.dataSimulacao,
        }
      : c,
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
    abertaEm: estado.dataSimulacao,
    abertaPor: RESPONSAVEL_POR_PERFIL.contratante,
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
      ? {
          ...d,
          status: 'resolvida' as const,
          resolucao: resolucao.trim(),
          resolvidaEm: estado.dataSimulacao,
          resolvidaPor: RESPONSAVEL_POR_PERFIL.contratante,
        }
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
  if (!contrato.moduloFinanceiroAtivo) {
    return {
      ok: false,
      mensagem:
        'Este contrato não tem módulo financeiro: não há aplicação nem rendimento a simular.',
    }
  }
  if (contrato.liberadoEm)
    return { ok: false, mensagem: 'Contrato já liberado: não há mais rendimentos a simular.' }

  const resumo = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  if (resumo.principalElegivelRendimentoCents <= 0) {
    return {
      ok: false,
      mensagem:
        'Não há principal depositado neste contrato. Confirme o depósito de uma retenção antes de simular o rendimento.',
    }
  }

  const periodo = resumo.ultimoPeriodoRendimento
    ? proximoPeriodo(resumo.ultimoPeriodoRendimento)
    : estado.dataSimulacao.slice(0, 7)

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
    criadoEm: carimbo(estado),
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
    c.id === contratoId ? { ...c, liberacaoSolicitadaEm: estado.dataSimulacao } : c,
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
    c.id === contratoId ? { ...c, liberadoEm: estado.dataSimulacao, liberacao } : c,
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
        `Liberação confirmada: ${formatarMoeda(liberacao.totalCents)}${contrato.moduloFinanceiroAtivo ? ` (principal de ${formatarMoeda(liberacao.principalCents)} + rendimentos de ${formatarMoeda(liberacao.rendimentoContratadaCents)})` : ''}.`,
        'contratante',
      ),
    },
    mensagem: `Liberação simulada de ${formatarMoeda(liberacao.totalCents)} confirmada.`,
  }
}

// ---------------------------------------------------------------- configurações e planos

export function salvarConfiguracoes(estado: EstadoDemo, config: Configuracoes): ResultadoAcao {
  // Alterações de taxa valem apenas para simulações futuras: os lançamentos já
  // registrados guardam a taxa aplicada na época e não são recalculados.
  return {
    ok: true,
    estado: { ...estado, configuracoes: { ...config } },
    mensagem: 'Parâmetros atualizados. Eles valem apenas para as próximas simulações.',
  }
}

export function definirPlano(
  estado: EstadoDemo,
  contratanteId: string,
  planoId: IdPlano,
): ResultadoAcao {
  const contratante = estado.contratantes.find((c) => c.id === contratanteId)
  if (!contratante) return { ok: false, mensagem: 'Contratante não encontrada.' }
  return {
    ok: true,
    estado: {
      ...estado,
      contratantes: estado.contratantes.map((c) =>
        c.id === contratanteId ? { ...c, planoId } : c,
      ),
    },
    mensagem: `Plano de ${contratante.nome} atualizado.`,
  }
}

export function alternarModuloFinanceiro(estado: EstadoDemo, contratoId: string): ResultadoAcao {
  const contrato = acharContrato(estado, contratoId)
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }
  const bloqueio = bloqueioPorLiberacao(contrato)
  if (bloqueio) return { ok: false, mensagem: bloqueio }
  if (contrato.moduloFinanceiroAtivo && estado.rendimentos.some((r) => r.contratoId === contratoId)) {
    return {
      ok: false,
      mensagem:
        'Este contrato já tem rendimentos lançados. Desligar o módulo financeiro apagaria o extrato; use "Restaurar demonstração" para recomeçar.',
    }
  }
  const ativo = !contrato.moduloFinanceiroAtivo
  return {
    ok: true,
    estado: {
      ...estado,
      contratos: estado.contratos.map((c) =>
        c.id === contratoId ? { ...c, moduloFinanceiroAtivo: ativo } : c,
      ),
    },
    mensagem: ativo
      ? 'Módulo financeiro ativado: o contrato passa a ter depósito, rendimento e participação da plataforma.'
      : 'Módulo financeiro desativado: o contrato acompanha apenas o saldo retido e as condições.',
  }
}

export { calcularDataMinimaLiberacao }
