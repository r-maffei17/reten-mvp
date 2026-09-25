// Dados fictícios da demonstração TrustRetain.
//
// Tudo é ancorado em DATA_SIMULACAO_INICIAL, e não no relógio do computador:
// assim todo mundo do grupo vê exatamente o mesmo cenário, e o seletor de data
// da simulação (perfil Plataforma) permite avançar ou recuar o relógio.

import { calcularDataMinimaLiberacao, calcularRendimento, calcularRetencao } from './calculos'
import { RESPONSAVEL_POR_PERFIL } from './atores'
import { somarDias, somarMeses } from './datas'
import type {
  Configuracoes,
  Contrato,
  Disputa,
  Documento,
  EstadoDemo,
  EventoHistorico,
  LancamentoRendimento,
  Medicao,
  VersaoDocumento,
} from './types'

export const VERSAO_DADOS = 3

/**
 * Data de referência inicial. Escolhida como a véspera do prazo do contrato de
 * teste padrão (31/07/2026): a demonstração abre com ele bloqueado, e um clique
 * no seletor de data mostra a trava de prazo caindo.
 */
export const DATA_SIMULACAO_INICIAL = '2026-07-30'

/** O contrato de teste padrão, usado no roteiro de demonstração. */
export const CONTRATO_PADRAO = {
  codigo: 'CT-2026-100',
  dataConclusao: '2026-06-01',
  prazoDiasCorridos: 60,
  dataMinimaLiberacao: calcularDataMinimaLiberacao('2026-06-01', 60), // 31/07/2026
  valorCents: 10_000_000, // R$ 100.000,00
  percentualRetencao: 5,
  retencaoCents: 500_000, // R$ 5.000,00
}

export const CONFIGURACOES_PADRAO: Configuracoes = {
  participacaoPercentual: 10, // 10% do rendimento bruto
  taxaMensalPercentual: 0.8, // 0,8% ao mês (hipótese de demonstração)
}

const CONTRATANTE = RESPONSAVEL_POR_PERFIL.contratante
const CONTRATADA = RESPONSAVEL_POR_PERFIL.contratada

export function criarDadosIniciais(): EstadoDemo {
  const hoje = DATA_SIMULACAO_INICIAL
  const config = { ...CONFIGURACOES_PADRAO }

  const dataHora = (diasAtras: number, hora = 10) =>
    `${somarDias(hoje, -diasAtras)}T${String(hora).padStart(2, '0')}:00:00`

  const periodoAnterior = (meses: number) => somarMeses(hoje, -meses).slice(0, 7)

  const contratantes = [
    {
      id: 'ct1',
      nome: 'Energia Vale Geração S.A.',
      cnpj: '12.345.678/0001-90',
      contato: 'Ana Ribeiro — Fiscalização de contratos',
      planoId: 'profissional' as const,
    },
    {
      id: 'ct2',
      nome: 'Infra Brasil Concessões S.A.',
      cnpj: '98.765.432/0001-10',
      contato: 'Paulo Tavares — Suprimentos',
      planoId: 'essencial' as const,
    },
  ]

  const contratadas = [
    {
      id: 'cd1',
      nome: 'Andrade Montagens Ltda.',
      cnpj: '11.222.333/0001-44',
      contato: 'Marcos Lima — Administração de contratos',
    },
    {
      id: 'cd2',
      nome: 'Norte Sul Construções Ltda.',
      cnpj: '55.666.777/0001-88',
      contato: 'Juliana Prado — Contratos',
    },
    {
      id: 'cd3',
      nome: 'Vertax Engenharia Ltda.',
      cnpj: '33.444.555/0001-22',
      contato: 'Rogério Sales — Financeiro',
    },
  ]

  const contratos: Contrato[] = [
    // ---- Contrato de teste padrão: bloqueado só pelo prazo na data inicial.
    {
      id: 'c0',
      codigo: CONTRATO_PADRAO.codigo,
      nome: 'Contrato de teste padrão — Reforma da subestação Leste',
      contratanteId: 'ct1',
      contratadaId: 'cd1',
      valorTotalCents: CONTRATO_PADRAO.valorCents,
      percentualRetencao: CONTRATO_PADRAO.percentualRetencao,
      dataInicio: '2026-01-15',
      dataTermino: CONTRATO_PADRAO.dataConclusao,
      moduloFinanceiroAtivo: false,
      dataConclusao: CONTRATO_PADRAO.dataConclusao,
      prazoDiasCorridos: CONTRATO_PADRAO.prazoDiasCorridos,
      dataMinimaLiberacao: CONTRATO_PADRAO.dataMinimaLiberacao,
      condicoesLiberacao:
        'Liberação integral após o aceite da entrega, aprovação de todos os documentos obrigatórios e decurso de 60 dias corridos contados do dia seguinte à conclusão.',
      entregaAceita: true,
      entregaAceitaEm: CONTRATO_PADRAO.dataConclusao,
      entregaAceitaPor: CONTRATANTE,
      criadoEm: '2026-01-15T09:00:00',
    },
    // ---- Módulo financeiro ativo, elegível: usado no exemplo de rendimento.
    {
      id: 'c1',
      codigo: 'CT-2024-001',
      nome: 'Subestação Norte 138 kV',
      contratanteId: 'ct1',
      contratadaId: 'cd1',
      valorTotalCents: 100_000_000, // R$ 1.000.000,00
      percentualRetencao: 5,
      dataInicio: somarMeses(hoje, -14),
      dataTermino: somarMeses(hoje, -2),
      moduloFinanceiroAtivo: true,
      dataConclusao: somarDias(hoje, -80),
      prazoDiasCorridos: 60,
      dataMinimaLiberacao: somarDias(hoje, -20),
      condicoesLiberacao:
        'Liberação integral após o aceite definitivo da obra, entrega das certidões negativas e decurso do prazo de 60 dias da conclusão.',
      entregaAceita: true,
      entregaAceitaEm: somarDias(hoje, -35),
      entregaAceitaPor: CONTRATANTE,
      criadoEm: dataHora(420),
    },
    // ---- Módulo financeiro ativo, várias pendências (documento pendente e em análise).
    {
      id: 'c2',
      codigo: 'CT-2025-014',
      nome: 'Linha de Transmissão Serra Azul — Lote 2',
      contratanteId: 'ct1',
      contratadaId: 'cd2',
      valorTotalCents: 240_000_000,
      percentualRetencao: 10,
      dataInicio: somarMeses(hoje, -8),
      dataTermino: somarMeses(hoje, 4),
      moduloFinanceiroAtivo: true,
      dataMinimaLiberacao: somarMeses(hoje, 5),
      condicoesLiberacao:
        'Liberação após o comissionamento do trecho, aprovação das certidões trabalhistas e aceite formal da fiscalização.',
      entregaAceita: false,
      criadoEm: dataHora(240),
    },
    // ---- Sem módulo financeiro, documento recusado com motivo.
    {
      id: 'c3',
      codigo: 'CT-2025-022',
      nome: 'Ampliação da ETE Jardim das Águas',
      contratanteId: 'ct2',
      contratadaId: 'cd3',
      valorTotalCents: 78_000_000,
      percentualRetencao: 5,
      dataInicio: somarMeses(hoje, -10),
      dataTermino: somarMeses(hoje, -1),
      moduloFinanceiroAtivo: false,
      dataMinimaLiberacao: somarDias(hoje, -10),
      condicoesLiberacao:
        'Liberação mediante ART de execução válida, relatório de comissionamento aprovado e aceite da entrega.',
      entregaAceita: false,
      criadoEm: dataHora(300),
    },
    // ---- Módulo financeiro ativo, bloqueado apenas pelo prazo.
    {
      id: 'c4',
      codigo: 'CT-2026-003',
      nome: 'Parque Solar Boa Vista — Bloco A',
      contratanteId: 'ct2',
      contratadaId: 'cd1',
      valorTotalCents: 520_000_000,
      percentualRetencao: 7,
      dataInicio: somarMeses(hoje, -6),
      dataTermino: somarMeses(hoje, -1),
      moduloFinanceiroAtivo: true,
      dataConclusao: somarDias(hoje, -45),
      prazoDiasCorridos: 90,
      dataMinimaLiberacao: somarDias(hoje, 45),
      condicoesLiberacao:
        'Liberação após 90 dias do aceite da entrega, com todas as obrigações documentais aprovadas.',
      entregaAceita: true,
      entregaAceitaEm: somarDias(hoje, -45),
      entregaAceitaPor: CONTRATANTE,
      criadoEm: dataHora(190),
    },
    // ---- Sem módulo financeiro, bloqueado apenas pela disputa.
    {
      id: 'c5',
      codigo: 'CT-2025-031',
      nome: 'Terraplenagem Trecho 4 — Rodovia BR-XXX',
      contratanteId: 'ct1',
      contratadaId: 'cd3',
      valorTotalCents: 185_000_000,
      percentualRetencao: 10,
      dataInicio: somarMeses(hoje, -9),
      dataTermino: somarMeses(hoje, -1),
      moduloFinanceiroAtivo: false,
      dataMinimaLiberacao: somarDias(hoje, -5),
      condicoesLiberacao:
        'Liberação após a regularização dos serviços apontados no relatório de fiscalização e aceite da entrega.',
      entregaAceita: true,
      entregaAceitaEm: somarDias(hoje, -25),
      entregaAceitaPor: CONTRATANTE,
      criadoEm: dataHora(270),
    },
  ]

  const porId = (id: string) => contratos.find((c) => c.id === id)!

  function medicao(
    id: string,
    contratoId: string,
    descricao: string,
    diasAtras: number,
    valorCents: number,
    depositoConfirmado: boolean,
  ): Medicao {
    const contrato = porId(contratoId)
    return {
      id,
      contratoId,
      descricao,
      data: somarDias(hoje, -diasAtras),
      valorCents,
      retencaoCents: calcularRetencao(valorCents, contrato.percentualRetencao),
      depositoConfirmado,
      depositoConfirmadoEm: depositoConfirmado ? somarDias(hoje, -(diasAtras - 2)) : undefined,
    }
  }

  const medicoes: Medicao[] = [
    // Contrato de teste padrão: medido integralmente, R$ 5.000,00 retidos.
    {
      id: 'm0',
      contratoId: 'c0',
      descricao: 'Medição única — reforma concluída',
      data: CONTRATO_PADRAO.dataConclusao,
      valorCents: CONTRATO_PADRAO.valorCents,
      retencaoCents: CONTRATO_PADRAO.retencaoCents,
      depositoConfirmado: false, // sem módulo financeiro, não há etapa de depósito
    },

    medicao('m1', 'c1', 'Medição 01 — montagem eletromecânica', 75, 10_000_000, true),

    medicao('m2', 'c2', 'Medição 01 — fundações das torres', 150, 30_000_000, true),
    medicao('m3', 'c2', 'Medição 02 — lançamento de cabos', 90, 25_000_000, true),
    medicao('m4', 'c2', 'Medição 03 — montagem de estruturas', 25, 18_000_000, false),

    medicao('m5', 'c3', 'Medição 01 — obras civis', 180, 20_000_000, false),
    medicao('m6', 'c3', 'Medição 02 — equipamentos e instalação', 100, 15_000_000, false),

    medicao('m7', 'c4', 'Medição 01 — estruturas e rastreadores', 140, 80_000_000, true),
    medicao('m8', 'c4', 'Medição 02 — módulos e inversores', 80, 60_000_000, true),

    medicao('m9', 'c5', 'Medição 01 — corte e aterro', 160, 40_000_000, false),
    medicao('m10', 'c5', 'Medição 02 — drenagem e sub-base', 95, 35_000_000, false),
  ]

  // --------------------------------------------------------------- documentos

  function arquivo(nome: string, versao: number, data: string): string {
    const base = nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
    return `${base}-v${versao}-${data.replace(/-/g, '')}.pdf`
  }

  /** Documento aprovado na primeira versão. */
  function aprovado(
    id: string,
    contratoId: string,
    nome: string,
    enviadoDiasAtras: number,
    analisadoDiasAtras: number,
    obrigatorio = true,
  ): Documento {
    const enviadoEm = somarDias(hoje, -enviadoDiasAtras)
    const analisadoEm = somarDias(hoje, -analisadoDiasAtras)
    const recebidoEm = somarDias(hoje, -(enviadoDiasAtras - 1))
    const nomeArquivo = arquivo(nome, 1, enviadoEm)
    const versao: VersaoDocumento = {
      versao: 1,
      arquivoNome: nomeArquivo,
      enviadoEm,
      enviadoPor: CONTRATADA,
      resultado: 'aprovado',
      recebidoEm,
      recebidoPor: CONTRATANTE,
      analisadoEm,
      analisadoPor: CONTRATANTE,
    }
    return {
      id,
      contratoId,
      nome,
      obrigatorio,
      status: 'aprovado',
      arquivoNome: nomeArquivo,
      enviadoEm,
      enviadoPor: CONTRATADA,
      recebidoEm,
      recebidoPor: CONTRATANTE,
      analisadoEm,
      analisadoPor: CONTRATANTE,
      versaoAtual: 1,
      versoes: [versao],
    }
  }

  const documentos: Documento[] = [
    // ---- c0: contrato de teste padrão, tudo aprovado.
    // A CND passou por uma recusa antes de ser aprovada: mostra o histórico de versões.
    {
      id: 'd0a',
      contratoId: 'c0',
      nome: 'Termo de aceite da obra',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: arquivo('Termo de aceite da obra', 1, '2026-06-01'),
      enviadoEm: '2026-06-01',
      enviadoPor: CONTRATADA,
      recebidoEm: '2026-06-02',
      recebidoPor: CONTRATANTE,
      analisadoEm: '2026-06-03',
      analisadoPor: CONTRATANTE,
      versaoAtual: 1,
      versoes: [
        {
          versao: 1,
          arquivoNome: arquivo('Termo de aceite da obra', 1, '2026-06-01'),
          enviadoEm: '2026-06-01',
          enviadoPor: CONTRATADA,
          resultado: 'aprovado',
          recebidoEm: '2026-06-02',
          recebidoPor: CONTRATANTE,
          analisadoEm: '2026-06-03',
          analisadoPor: CONTRATANTE,
        },
      ],
    },
    {
      id: 'd0b',
      contratoId: 'c0',
      nome: 'Certidão Negativa de Débitos Trabalhistas',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: arquivo('Certidão Negativa de Débitos Trabalhistas', 2, '2026-06-18'),
      enviadoEm: '2026-06-18',
      enviadoPor: CONTRATADA,
      recebidoEm: '2026-06-19',
      recebidoPor: CONTRATANTE,
      analisadoEm: '2026-06-22',
      analisadoPor: CONTRATANTE,
      versaoAtual: 2,
      versoes: [
        {
          versao: 1,
          arquivoNome: arquivo('Certidão Negativa de Débitos Trabalhistas', 1, '2026-06-05'),
          enviadoEm: '2026-06-05',
          enviadoPor: CONTRATADA,
          resultado: 'rejeitado',
          recebidoEm: '2026-06-08',
          recebidoPor: CONTRATANTE,
          analisadoEm: '2026-06-10',
          analisadoPor: CONTRATANTE,
          motivoRejeicao:
            'Certidão com validade vencida em 30/05/2026. Reenviar a via vigente na data do pedido de liberação.',
        },
        {
          versao: 2,
          arquivoNome: arquivo('Certidão Negativa de Débitos Trabalhistas', 2, '2026-06-18'),
          enviadoEm: '2026-06-18',
          enviadoPor: CONTRATADA,
          resultado: 'aprovado',
          recebidoEm: '2026-06-19',
          recebidoPor: CONTRATANTE,
          analisadoEm: '2026-06-22',
          analisadoPor: CONTRATANTE,
        },
      ],
    },

    // ---- c1: tudo aprovado.
    aprovado('d1', 'c1', 'Termo de aceite definitivo da obra', 40, 36),
    aprovado('d2', 'c1', 'Certidão Negativa de Débitos Trabalhistas', 38, 34),
    aprovado('d3', 'c1', 'Relatório fotográfico final', 38, 33, false),

    // ---- c2: um pendente e um em análise.
    {
      id: 'd4',
      contratoId: 'c2',
      nome: 'Certidão Negativa de Débitos Trabalhistas',
      obrigatorio: true,
      status: 'pendente',
      prazo: somarDias(hoje, 7),
      versaoAtual: 0,
      versoes: [],
    },
    aprovado('d5', 'c2', 'Apólice de seguro de risco de engenharia', 120, 117),
    {
      id: 'd6',
      contratoId: 'c2',
      nome: 'Relatório de comissionamento do trecho',
      obrigatorio: true,
      status: 'enviado',
      prazo: somarDias(hoje, 3),
      arquivoNome: arquivo('Relatório de comissionamento do trecho', 1, somarDias(hoje, -6)),
      enviadoEm: somarDias(hoje, -6),
      enviadoPor: CONTRATADA,
      versaoAtual: 1,
      versoes: [
        {
          versao: 1,
          arquivoNome: arquivo('Relatório de comissionamento do trecho', 1, somarDias(hoje, -6)),
          enviadoEm: somarDias(hoje, -6),
          enviadoPor: CONTRATADA,
          resultado: 'em_analise',
        },
      ],
    },

    // ---- c3: documento recusado, com motivo, data e responsável.
    {
      id: 'd7',
      contratoId: 'c3',
      nome: 'ART de execução da obra',
      obrigatorio: true,
      status: 'rejeitado',
      prazo: somarDias(hoje, 5),
      arquivoNome: arquivo('ART de execução da obra', 1, somarDias(hoje, -22)),
      enviadoEm: somarDias(hoje, -22),
      enviadoPor: CONTRATADA,
      recebidoEm: somarDias(hoje, -21),
      recebidoPor: CONTRATANTE,
      analisadoEm: somarDias(hoje, -18),
      analisadoPor: CONTRATANTE,
      motivoRejeicao:
        'A ART enviada está sem a assinatura do responsável técnico e sem o número de registro no CREA. Reenviar a via assinada e com registro válido.',
      versaoAtual: 1,
      versoes: [
        {
          versao: 1,
          arquivoNome: arquivo('ART de execução da obra', 1, somarDias(hoje, -22)),
          enviadoEm: somarDias(hoje, -22),
          enviadoPor: CONTRATADA,
          resultado: 'rejeitado',
          recebidoEm: somarDias(hoje, -21),
          recebidoPor: CONTRATANTE,
          analisadoEm: somarDias(hoje, -18),
          analisadoPor: CONTRATANTE,
          motivoRejeicao:
            'A ART enviada está sem a assinatura do responsável técnico e sem o número de registro no CREA. Reenviar a via assinada e com registro válido.',
        },
      ],
    },
    aprovado('d8', 'c3', 'Relatório de comissionamento', 30, 27),

    // ---- c4 e c5: documentação em dia.
    aprovado('d9', 'c4', 'Termo de aceite provisório', 50, 46),
    aprovado('d10', 'c4', 'Certidão Negativa de Débitos Trabalhistas', 49, 45),
    aprovado('d11', 'c5', 'Termo de aceite da entrega', 30, 26),
    aprovado('d12', 'c5', 'Certidão Negativa de Débitos Trabalhistas', 31, 28),
  ]

  const disputas: Disputa[] = [
    {
      id: 'dp1',
      contratoId: 'c5',
      descricao:
        'Divergência sobre o volume de material drenante medido no trecho 4B. A fiscalização aponta 1.200 m³ e a contratada apresentou 1.480 m³.',
      abertaEm: somarDias(hoje, -12),
      abertaPor: CONTRATANTE,
      status: 'aberta',
    },
  ]

  // Rendimentos já lançados, apenas em contratos com módulo financeiro ativo.
  // O contrato c1 fica sem lançamentos de propósito: serve de exemplo ao vivo.
  const rendimentos: LancamentoRendimento[] = []
  const contratosComRendimento: Array<[string, number]> = [
    ['c2', 3_000_000 + 2_500_000],
    ['c4', 5_600_000 + 4_200_000],
  ]
  for (const [contratoId, principal] of contratosComRendimento) {
    for (const meses of [2, 1]) {
      const periodo = periodoAnterior(meses)
      const r = calcularRendimento(principal, config.taxaMensalPercentual, config.participacaoPercentual)
      rendimentos.push({
        id: `r-${contratoId}-${periodo}`,
        contratoId,
        periodo,
        principalBaseCents: r.principalBaseCents,
        taxaMensalPercentual: config.taxaMensalPercentual,
        participacaoPercentual: config.participacaoPercentual,
        rendimentoBrutoCents: r.rendimentoBrutoCents,
        receitaPlataformaCents: r.receitaPlataformaCents,
        rendimentoContratadaCents: r.rendimentoContratadaCents,
        criadoEm: `${periodo}-28T09:00:00`,
      })
    }
  }

  // --------------------------------------------------------------- histórico

  const historico: EventoHistorico[] = []
  let seq = 0
  const evento = (
    contratoId: string,
    tipo: EventoHistorico['tipo'],
    descricao: string,
    perfil: EventoHistorico['perfil'],
    diasAtras: number,
  ) => {
    seq += 1
    historico.push({
      id: `h${seq}`,
      contratoId,
      tipo,
      descricao,
      perfil,
      autor: RESPONSAVEL_POR_PERFIL[perfil],
      data: dataHora(diasAtras, 9 + (seq % 8)),
    })
  }

  for (const c of contratos) {
    evento(c.id, 'contrato_criado', `Contrato ${c.codigo} cadastrado na plataforma.`, 'contratante', 400)
  }

  evento('c0', 'medicao_registrada', 'Medição única registrada: R$ 100.000,00 com retenção de R$ 5.000,00.', 'contratante', 60)
  evento('c0', 'entrega_aceita', 'Conclusão e aceite da obra registrados em 01/06/2026.', 'contratante', 59)
  evento('c0', 'documento_rejeitado', 'Documento "Certidão Negativa de Débitos Trabalhistas" (versão 1) recusado por validade vencida.', 'contratante', 50)
  evento('c0', 'documento_enviado', 'Reenvio do documento "Certidão Negativa de Débitos Trabalhistas" (versão 2).', 'contratada', 42)
  evento('c0', 'documento_aprovado', 'Documento "Certidão Negativa de Débitos Trabalhistas" (versão 2) aprovado.', 'contratante', 38)

  evento('c1', 'medicao_registrada', 'Medição 01 registrada: R$ 100.000,00 com retenção de R$ 5.000,00.', 'contratante', 75)
  evento('c1', 'deposito_confirmado', 'Depósito da retenção da Medição 01 confirmado.', 'contratante', 73)
  evento('c1', 'entrega_aceita', 'Aceite da entrega registrado pela contratante.', 'contratante', 35)

  evento('c2', 'medicao_registrada', 'Medição 03 registrada: R$ 180.000,00 com retenção de R$ 18.000,00.', 'contratante', 25)
  evento('c2', 'documento_enviado', 'Documento "Relatório de comissionamento do trecho" enviado (versão 1).', 'contratada', 6)

  evento('c3', 'documento_enviado', 'Documento "ART de execução da obra" enviado (versão 1).', 'contratada', 22)
  evento('c3', 'documento_rejeitado', 'Documento "ART de execução da obra" recusado pela contratante.', 'contratante', 18)

  evento('c4', 'entrega_aceita', 'Aceite da entrega registrado pela contratante.', 'contratante', 45)
  evento('c5', 'disputa_aberta', 'Disputa registrada pela contratante sobre a medição do trecho 4B.', 'contratante', 12)

  historico.sort((a, b) => (a.data < b.data ? 1 : -1))

  return {
    versao: VERSAO_DADOS,
    dataSimulacao: DATA_SIMULACAO_INICIAL,
    contratantes,
    contratadas,
    contratos,
    medicoes,
    documentos,
    disputas,
    rendimentos,
    historico,
    configuracoes: config,
  }
}
