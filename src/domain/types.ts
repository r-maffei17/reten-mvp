// Modelo de dados da demonstração Reten.
// Todos os valores monetários são inteiros em CENTAVOS para evitar erros de ponto flutuante.

export type Perfil = 'contratante' | 'contratada' | 'plataforma'

export type StatusDocumento = 'pendente' | 'enviado' | 'aprovado' | 'rejeitado'

export type StatusLiberacao = 'bloqueada' | 'elegivel' | 'solicitada' | 'liberada'

export interface Empresa {
  id: string
  nome: string
  cnpj: string
}

export interface Contrato {
  id: string
  codigo: string
  nome: string
  contratanteId: string
  contratadaId: string
  valorTotalCents: number
  /** Percentual de retenção sobre cada medição. Ex.: 5 = 5%. */
  percentualRetencao: number
  dataInicio: string // ISO yyyy-mm-dd
  dataTermino: string // ISO yyyy-mm-dd
  dataMinimaLiberacao: string // ISO yyyy-mm-dd
  condicoesLiberacao: string
  entregaAceita: boolean
  entregaAceitaEm?: string
  liberacaoSolicitadaEm?: string
  liberadoEm?: string
  /** Fotografia do que foi liberado, preservada após a liberação. */
  liberacao?: {
    principalCents: number
    rendimentoContratadaCents: number
    totalCents: number
  }
  criadoEm: string
}

export interface Medicao {
  id: string
  contratoId: string
  descricao: string
  data: string // ISO yyyy-mm-dd
  valorCents: number
  /** Retenção calculada no momento do registro, preservada mesmo se o contrato mudar. */
  retencaoCents: number
  depositoConfirmado: boolean
  depositoConfirmadoEm?: string
}

export interface Documento {
  id: string
  contratoId: string
  nome: string
  obrigatorio: boolean
  status: StatusDocumento
  arquivoNome?: string
  enviadoEm?: string
  analisadoEm?: string
  motivoRejeicao?: string
}

export interface Disputa {
  id: string
  contratoId: string
  descricao: string
  abertaEm: string
  status: 'aberta' | 'resolvida'
  resolucao?: string
  resolvidaEm?: string
}

/** Um lançamento de rendimento por período (mês/ano) e por contrato. */
export interface LancamentoRendimento {
  id: string
  contratoId: string
  /** Período no formato 'YYYY-MM'. */
  periodo: string
  principalBaseCents: number
  /** Taxa mensal hipotética aplicada, em % (ex.: 0.8). Preservada historicamente. */
  taxaMensalPercentual: number
  /** Participação da plataforma aplicada, em % (ex.: 10). Preservada historicamente. */
  participacaoPercentual: number
  rendimentoBrutoCents: number
  receitaPlataformaCents: number
  rendimentoContratadaCents: number
  criadoEm: string
}

export type TipoEvento =
  | 'contrato_criado'
  | 'medicao_registrada'
  | 'deposito_confirmado'
  | 'documento_enviado'
  | 'documento_aprovado'
  | 'documento_rejeitado'
  | 'entrega_aceita'
  | 'disputa_aberta'
  | 'disputa_resolvida'
  | 'rendimento_simulado'
  | 'liberacao_solicitada'
  | 'liberacao_confirmada'

export interface EventoHistorico {
  id: string
  contratoId: string
  tipo: TipoEvento
  descricao: string
  perfil: Perfil
  data: string // ISO datetime
}

export interface Configuracoes {
  /** Mensalidade cobrada de cada contratante, em centavos. */
  mensalidadeCents: number
  /** Participação da plataforma sobre o rendimento bruto, em % (ex.: 10). */
  participacaoPercentual: number
  /** Taxa mensal hipotética da aplicação, em % (ex.: 0.8). */
  taxaMensalPercentual: number
}

export interface EstadoDemo {
  versao: number
  contratantes: Empresa[]
  contratadas: Empresa[]
  contratos: Contrato[]
  medicoes: Medicao[]
  documentos: Documento[]
  disputas: Disputa[]
  rendimentos: LancamentoRendimento[]
  historico: EventoHistorico[]
  configuracoes: Configuracoes
}
