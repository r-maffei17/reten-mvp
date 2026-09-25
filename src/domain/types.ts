// Modelo de dados da demonstração TrustRetain.
// Todos os valores monetários são inteiros em CENTAVOS para evitar erros de ponto flutuante.

export type Perfil = 'contratante' | 'contratada' | 'plataforma'

export type StatusDocumento = 'pendente' | 'enviado' | 'aprovado' | 'rejeitado'

export type StatusLiberacao = 'bloqueada' | 'elegivel' | 'solicitada' | 'liberada'

export type IdPlano = 'essencial' | 'profissional' | 'corporativo'

export interface Empresa {
  id: string
  nome: string
  cnpj: string
  /** Pessoa responsável pelos contratos nesta empresa (aparece nas pendências). */
  contato: string
  /** Somente para contratantes: plano contratado. Fornecedores convidados não pagam. */
  planoId?: IdPlano
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
  /**
   * Módulo financeiro opcional. Quando desligado, o contrato acompanha apenas o
   * saldo retido e as condições de liberação: não há depósito em custódia,
   * rendimento nem participação da plataforma.
   */
  moduloFinanceiroAtivo: boolean
  /** Data da conclusão e do aceite da obra, quando registrada. */
  dataConclusao?: string
  /** Prazo contratual em dias corridos, contado a partir do dia seguinte à conclusão. */
  prazoDiasCorridos?: number
  dataMinimaLiberacao: string // ISO yyyy-mm-dd
  condicoesLiberacao: string
  entregaAceita: boolean
  entregaAceitaEm?: string
  entregaAceitaPor?: string
  liberacaoSolicitadaEm?: string
  liberadoEm?: string
  /** Fotografia do que foi liberado, preservada após a liberação. */
  liberacao?: {
    principalCents: number
    rendimentoContratadaCents: number
    totalCents: number
  }
  /** Marca contratos criados pela importação de cauções do ERP. */
  origem?: 'erp'
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
  /** Só tem efeito quando o módulo financeiro do contrato está ativo. */
  depositoConfirmado: boolean
  depositoConfirmadoEm?: string
}

/** Uma versão enviada de um documento. O histórico completo é preservado. */
export interface VersaoDocumento {
  versao: number
  arquivoNome: string
  enviadoEm: string
  enviadoPor: string
  resultado: 'em_analise' | 'aprovado' | 'rejeitado'
  recebidoEm?: string
  recebidoPor?: string
  analisadoEm?: string
  analisadoPor?: string
  motivoRejeicao?: string
}

export interface Documento {
  id: string
  contratoId: string
  nome: string
  obrigatorio: boolean
  status: StatusDocumento
  /** Data limite para a entrega ou regularização do documento. */
  prazo?: string
  arquivoNome?: string
  enviadoEm?: string
  enviadoPor?: string
  recebidoEm?: string
  recebidoPor?: string
  analisadoEm?: string
  analisadoPor?: string
  motivoRejeicao?: string
  /** Versão atual (1 na primeira remessa, 2 no primeiro reenvio, e assim por diante). */
  versaoAtual: number
  versoes: VersaoDocumento[]
}

export interface Disputa {
  id: string
  contratoId: string
  descricao: string
  abertaEm: string
  abertaPor: string
  status: 'aberta' | 'resolvida'
  resolucao?: string
  resolvidaEm?: string
  resolvidaPor?: string
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
  | 'contrato_importado'
  | 'medicao_registrada'
  | 'deposito_confirmado'
  | 'documento_enviado'
  | 'documento_recebido'
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
  /** Pessoa que praticou o ato. */
  autor: string
  data: string // ISO datetime
}

export interface Configuracoes {
  /** Participação da plataforma sobre o rendimento bruto, em % (ex.: 10). */
  participacaoPercentual: number
  /** Taxa mensal hipotética da aplicação, em % (ex.: 0.8). */
  taxaMensalPercentual: number
}

export interface EstadoDemo {
  versao: number
  /**
   * Data de referência da simulação. Substitui "hoje" em toda a aplicação, para
   * que a apresentação possa avançar ou recuar o relógio e mostrar o efeito das
   * travas de prazo.
   */
  dataSimulacao: string
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
