// Regras de elegibilidade para a liberação da retenção.
// Camada pura, usada tanto na exibição do checklist quanto na revalidação no momento da confirmação.

import { calcularResumoContrato, disputaAberta } from './calculos'
import { dataAtingida, formatarData } from './datas'
import type {
  Contrato,
  Disputa,
  Documento,
  EstadoDemo,
  LancamentoRendimento,
  Medicao,
  StatusLiberacao,
} from './types'

export type ChaveCondicao =
  | 'depositos'
  | 'documentos'
  | 'entrega'
  | 'data_minima'
  | 'sem_disputa'
  | 'saldo'

export interface Condicao {
  chave: ChaveCondicao
  titulo: string
  cumprida: boolean
  detalhe: string
}

export interface AvaliacaoLiberacao {
  condicoes: Condicao[]
  pendencias: Condicao[]
  todasCumpridas: boolean
  status: StatusLiberacao
  saldoParaLiberacaoCents: number
}

export function avaliarLiberacao(
  contrato: Contrato,
  medicoes: Medicao[],
  documentos: Documento[],
  disputas: Disputa[],
  rendimentos: LancamentoRendimento[],
): AvaliacaoLiberacao {
  const resumo = calcularResumoContrato(contrato, medicoes, documentos, rendimentos)
  const doContrato = medicoes.filter((m) => m.contratoId === contrato.id)
  const docsObrigatorios = documentos.filter((d) => d.contratoId === contrato.id && d.obrigatorio)
  const docsPendentes = docsObrigatorios.filter((d) => d.status !== 'aprovado')
  const semDeposito = doContrato.filter((m) => !m.depositoConfirmado)
  const disputa = disputaAberta(disputas, contrato.id)

  const condicoes: Condicao[] = [
    {
      chave: 'depositos',
      titulo: 'Depósitos simulados confirmados',
      cumprida: doContrato.length > 0 && semDeposito.length === 0,
      detalhe:
        doContrato.length === 0
          ? 'Nenhuma medição registrada até o momento.'
          : semDeposito.length === 0
            ? `Todas as ${doContrato.length} medições têm depósito confirmado.`
            : `${semDeposito.length} de ${doContrato.length} medições aguardam confirmação de depósito.`,
    },
    {
      chave: 'documentos',
      titulo: 'Documentos obrigatórios aprovados',
      cumprida: docsPendentes.length === 0,
      detalhe:
        docsObrigatorios.length === 0
          ? 'Nenhum documento obrigatório cadastrado.'
          : docsPendentes.length === 0
            ? `Todos os ${docsObrigatorios.length} documentos obrigatórios estão aprovados.`
            : `Aguardando: ${docsPendentes.map((d) => d.nome).join(', ')}.`,
    },
    {
      chave: 'entrega',
      titulo: 'Entrega aceita pela contratante',
      cumprida: contrato.entregaAceita,
      detalhe: contrato.entregaAceita
        ? `Aceite registrado em ${formatarData(contrato.entregaAceitaEm)}.`
        : 'A contratante ainda não registrou o aceite da entrega.',
    },
    {
      chave: 'data_minima',
      titulo: 'Data mínima de liberação atingida',
      cumprida: dataAtingida(contrato.dataMinimaLiberacao),
      detalhe: dataAtingida(contrato.dataMinimaLiberacao)
        ? `Data mínima (${formatarData(contrato.dataMinimaLiberacao)}) já atingida.`
        : `Liberação possível a partir de ${formatarData(contrato.dataMinimaLiberacao)}.`,
    },
    {
      chave: 'sem_disputa',
      titulo: 'Sem disputa em aberto',
      cumprida: !disputa,
      detalhe: disputa ? `Disputa em aberto: ${disputa.descricao}` : 'Nenhuma disputa em aberto.',
    },
    {
      chave: 'saldo',
      titulo: 'Saldo positivo para liberação',
      cumprida: resumo.saldoParaLiberacaoCents > 0,
      detalhe:
        resumo.saldoParaLiberacaoCents > 0
          ? 'Há saldo retido disponível para liberação.'
          : 'Não há saldo retido neste contrato.',
    },
  ]

  const pendencias = condicoes.filter((c) => !c.cumprida)
  const todasCumpridas = pendencias.length === 0

  let status: StatusLiberacao
  if (contrato.liberadoEm) status = 'liberada'
  else if (contrato.liberacaoSolicitadaEm) status = 'solicitada'
  else if (todasCumpridas) status = 'elegivel'
  else status = 'bloqueada'

  return {
    condicoes,
    pendencias,
    todasCumpridas,
    status,
    saldoParaLiberacaoCents: resumo.saldoParaLiberacaoCents,
  }
}

/** Atalho que lê tudo do estado da demonstração. */
export function avaliarLiberacaoDoEstado(estado: EstadoDemo, contrato: Contrato): AvaliacaoLiberacao {
  return avaliarLiberacao(
    contrato,
    estado.medicoes,
    estado.documentos,
    estado.disputas,
    estado.rendimentos,
  )
}

export const ROTULO_STATUS_LIBERACAO: Record<StatusLiberacao, string> = {
  bloqueada: 'Bloqueada por pendências',
  elegivel: 'Elegível para solicitação',
  solicitada: 'Liberação solicitada',
  liberada: 'Liberada',
}

export const ROTULO_STATUS_DOCUMENTO: Record<Documento['status'], string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}
