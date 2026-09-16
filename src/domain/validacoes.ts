// Validações de formulário. Puras: recebem os dados já convertidos e devolvem erros por campo.

import { calcularResumoContrato } from './calculos'
import type { Contrato, Documento, LancamentoRendimento, Medicao } from './types'

export type ErrosFormulario = Record<string, string>

export interface DadosContratoFormulario {
  nome: string
  codigo: string
  contratanteId: string
  contratadaId: string
  valorTotalCents: number | null
  percentualRetencao: number | null
  dataInicio: string
  dataTermino: string
  dataMinimaLiberacao: string
  condicoesLiberacao: string
}

export function validarContrato(
  dados: DadosContratoFormulario,
  contratosExistentes: Contrato[],
  contratoIdAtual?: string,
): ErrosFormulario {
  const erros: ErrosFormulario = {}

  if (!dados.nome.trim()) erros.nome = 'Informe o nome do contrato.'
  if (!dados.codigo.trim()) erros.codigo = 'Informe o código do contrato.'
  else if (
    contratosExistentes.some(
      (c) => c.id !== contratoIdAtual && c.codigo.toLowerCase() === dados.codigo.trim().toLowerCase(),
    )
  ) {
    erros.codigo = 'Já existe um contrato com este código.'
  }

  if (!dados.contratanteId) erros.contratanteId = 'Selecione a contratante.'
  if (!dados.contratadaId) erros.contratadaId = 'Selecione a contratada.'

  if (dados.valorTotalCents === null) erros.valorTotal = 'Informe o valor total do contrato.'
  else if (dados.valorTotalCents <= 0) erros.valorTotal = 'O valor total deve ser maior que zero.'

  if (dados.percentualRetencao === null) erros.percentualRetencao = 'Informe o percentual de retenção.'
  else if (dados.percentualRetencao < 0 || dados.percentualRetencao > 100)
    erros.percentualRetencao = 'O percentual deve estar entre 0 e 100.'

  if (!dados.dataInicio) erros.dataInicio = 'Informe a data de início.'
  if (!dados.dataTermino) erros.dataTermino = 'Informe a data de término.'
  if (dados.dataInicio && dados.dataTermino && dados.dataTermino < dados.dataInicio)
    erros.dataTermino = 'O término deve ser igual ou posterior ao início.'

  if (!dados.dataMinimaLiberacao) erros.dataMinimaLiberacao = 'Informe a data mínima para liberação.'
  else if (dados.dataInicio && dados.dataMinimaLiberacao < dados.dataInicio)
    erros.dataMinimaLiberacao = 'A data mínima deve ser igual ou posterior ao início do contrato.'

  if (!dados.condicoesLiberacao.trim())
    erros.condicoesLiberacao = 'Descreva as condições de liberação.'

  return erros
}

export interface DadosMedicaoFormulario {
  descricao: string
  data: string
  valorCents: number | null
}

export function validarMedicao(
  dados: DadosMedicaoFormulario,
  contrato: Contrato,
  medicoes: Medicao[],
  documentos: Documento[],
  rendimentos: LancamentoRendimento[],
): ErrosFormulario {
  const erros: ErrosFormulario = {}

  if (!dados.descricao.trim()) erros.descricao = 'Informe a descrição da medição.'
  if (!dados.data) erros.data = 'Informe a data da medição.'
  else if (dados.data < contrato.dataInicio)
    erros.data = 'A medição não pode ser anterior ao início do contrato.'

  if (dados.valorCents === null) erros.valor = 'Informe o valor da medição.'
  else if (dados.valorCents <= 0) erros.valor = 'O valor da medição deve ser maior que zero.'
  else {
    const resumo = calcularResumoContrato(contrato, medicoes, documentos, rendimentos)
    if (dados.valorCents > resumo.saldoAMedirCents) {
      erros.valor = `A soma das medições não pode ultrapassar o valor do contrato. Disponível para medir: ${(
        resumo.saldoAMedirCents / 100
      ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
    }
  }

  return erros
}

export function validarRejeicaoDocumento(motivo: string): ErrosFormulario {
  const erros: ErrosFormulario = {}
  if (!motivo.trim()) erros.motivo = 'A justificativa é obrigatória para rejeitar um documento.'
  else if (motivo.trim().length < 10)
    erros.motivo = 'Descreva a justificativa com pelo menos 10 caracteres.'
  return erros
}

export function validarDisputa(descricao: string): ErrosFormulario {
  const erros: ErrosFormulario = {}
  if (!descricao.trim()) erros.descricao = 'Descreva o motivo da disputa.'
  else if (descricao.trim().length < 10)
    erros.descricao = 'Descreva a disputa com pelo menos 10 caracteres.'
  return erros
}

export interface DadosConfiguracoesFormulario {
  mensalidadeCents: number | null
  participacaoPercentual: number | null
  taxaMensalPercentual: number | null
}

export function validarConfiguracoes(dados: DadosConfiguracoesFormulario): ErrosFormulario {
  const erros: ErrosFormulario = {}

  if (dados.mensalidadeCents === null) erros.mensalidade = 'Informe a mensalidade.'
  else if (dados.mensalidadeCents < 0) erros.mensalidade = 'A mensalidade não pode ser negativa.'

  if (dados.participacaoPercentual === null) erros.participacao = 'Informe a participação da plataforma.'
  else if (dados.participacaoPercentual < 0 || dados.participacaoPercentual > 100)
    erros.participacao = 'O percentual deve estar entre 0 e 100.'

  if (dados.taxaMensalPercentual === null) erros.taxa = 'Informe a taxa mensal hipotética.'
  else if (dados.taxaMensalPercentual < 0 || dados.taxaMensalPercentual > 100)
    erros.taxa = 'A taxa deve estar entre 0 e 100.'

  return erros
}

export function temErros(erros: ErrosFormulario): boolean {
  return Object.keys(erros).length > 0
}
