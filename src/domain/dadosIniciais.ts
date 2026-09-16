// Dados fictícios da demonstração.
// As datas são relativas ao dia em que a demonstração é aberta, para que os
// exemplos continuem coerentes com o passar do tempo.

import { calcularRendimento, calcularRetencao } from './calculos'
import { hojeISO, periodoAtual, somarDias, somarMeses } from './datas'
import type {
  Configuracoes,
  Contrato,
  Disputa,
  Documento,
  EstadoDemo,
  EventoHistorico,
  LancamentoRendimento,
  Medicao,
} from './types'

export const VERSAO_DADOS = 1

export const CONFIGURACOES_PADRAO: Configuracoes = {
  mensalidadeCents: 49900, // R$ 499,00
  participacaoPercentual: 10, // 10% do rendimento bruto
  taxaMensalPercentual: 0.8, // 0,8% ao mês (hipótese de demonstração)
}

/** Período anterior ao atual, deslocado em `meses`. */
function periodoAnterior(meses: number): string {
  const iso = somarMeses(hojeISO(), -meses)
  return iso.slice(0, 7)
}

function dataHora(diasAtras: number, hora = 10): string {
  const iso = somarDias(hojeISO(), -diasAtras)
  return `${iso}T${String(hora).padStart(2, '0')}:00:00`
}

export function criarDadosIniciais(): EstadoDemo {
  const hoje = hojeISO()
  const config = { ...CONFIGURACOES_PADRAO }

  const contratantes = [
    { id: 'ct1', nome: 'Energia Vale Geração S.A.', cnpj: '12.345.678/0001-90' },
    { id: 'ct2', nome: 'Infra Brasil Concessões S.A.', cnpj: '98.765.432/0001-10' },
  ]

  const contratadas = [
    { id: 'cd1', nome: 'Andrade Montagens Ltda.', cnpj: '11.222.333/0001-44' },
    { id: 'cd2', nome: 'Norte Sul Construções Ltda.', cnpj: '55.666.777/0001-88' },
    { id: 'cd3', nome: 'Vertax Engenharia Ltda.', cnpj: '33.444.555/0001-22' },
  ]

  const contratos: Contrato[] = [
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
      dataMinimaLiberacao: somarDias(hoje, -20),
      condicoesLiberacao:
        'Liberação integral após o aceite definitivo da obra, entrega das certidões negativas e decurso do prazo de 60 dias da conclusão.',
      entregaAceita: true,
      entregaAceitaEm: somarDias(hoje, -35),
      criadoEm: dataHora(420),
    },
    {
      id: 'c2',
      codigo: 'CT-2025-014',
      nome: 'Linha de Transmissão Serra Azul — Lote 2',
      contratanteId: 'ct1',
      contratadaId: 'cd2',
      valorTotalCents: 240_000_000, // R$ 2.400.000,00
      percentualRetencao: 10,
      dataInicio: somarMeses(hoje, -8),
      dataTermino: somarMeses(hoje, 4),
      dataMinimaLiberacao: somarMeses(hoje, 5),
      condicoesLiberacao:
        'Liberação após o comissionamento do trecho, aprovação das certidões trabalhistas e aceite formal da fiscalização.',
      entregaAceita: false,
      criadoEm: dataHora(240),
    },
    {
      id: 'c3',
      codigo: 'CT-2025-022',
      nome: 'Ampliação da ETE Jardim das Águas',
      contratanteId: 'ct2',
      contratadaId: 'cd3',
      valorTotalCents: 78_000_000, // R$ 780.000,00
      percentualRetencao: 5,
      dataInicio: somarMeses(hoje, -10),
      dataTermino: somarMeses(hoje, -1),
      dataMinimaLiberacao: somarDias(hoje, -10),
      condicoesLiberacao:
        'Liberação mediante ART de execução válida, relatório de comissionamento aprovado e aceite da entrega.',
      entregaAceita: false,
      criadoEm: dataHora(300),
    },
    {
      id: 'c4',
      codigo: 'CT-2026-003',
      nome: 'Parque Solar Boa Vista — Bloco A',
      contratanteId: 'ct2',
      contratadaId: 'cd1',
      valorTotalCents: 520_000_000, // R$ 5.200.000,00
      percentualRetencao: 7,
      dataInicio: somarMeses(hoje, -6),
      dataTermino: somarMeses(hoje, -1),
      dataMinimaLiberacao: somarDias(hoje, 45),
      condicoesLiberacao:
        'Liberação após 90 dias do aceite da entrega, com todas as obrigações documentais aprovadas.',
      entregaAceita: true,
      entregaAceitaEm: somarDias(hoje, -45),
      criadoEm: dataHora(190),
    },
    {
      id: 'c5',
      codigo: 'CT-2025-031',
      nome: 'Terraplenagem Trecho 4 — Rodovia BR-XXX',
      contratanteId: 'ct1',
      contratadaId: 'cd3',
      valorTotalCents: 185_000_000, // R$ 1.850.000,00
      percentualRetencao: 10,
      dataInicio: somarMeses(hoje, -9),
      dataTermino: somarMeses(hoje, -1),
      dataMinimaLiberacao: somarDias(hoje, -5),
      condicoesLiberacao:
        'Liberação após a regularização dos serviços apontados no relatório de fiscalização e aceite da entrega.',
      entregaAceita: true,
      entregaAceitaEm: somarDias(hoje, -25),
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
    medicao('m1', 'c1', 'Medição 01 — montagem eletromecânica', 75, 10_000_000, true),

    medicao('m2', 'c2', 'Medição 01 — fundações das torres', 150, 30_000_000, true),
    medicao('m3', 'c2', 'Medição 02 — lançamento de cabos', 90, 25_000_000, true),
    medicao('m4', 'c2', 'Medição 03 — montagem de estruturas', 25, 18_000_000, false),

    medicao('m5', 'c3', 'Medição 01 — obras civis', 180, 20_000_000, true),
    medicao('m6', 'c3', 'Medição 02 — equipamentos e instalação', 100, 15_000_000, true),

    medicao('m7', 'c4', 'Medição 01 — estruturas e rastreadores', 140, 80_000_000, true),
    medicao('m8', 'c4', 'Medição 02 — módulos e inversores', 80, 60_000_000, true),

    medicao('m9', 'c5', 'Medição 01 — corte e aterro', 160, 40_000_000, true),
    medicao('m10', 'c5', 'Medição 02 — drenagem e sub-base', 95, 35_000_000, true),
  ]

  const documentos: Documento[] = [
    // C1 — tudo aprovado (contrato elegível para liberação)
    {
      id: 'd1',
      contratoId: 'c1',
      nome: 'Termo de aceite definitivo da obra',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'termo-aceite-definitivo.pdf',
      enviadoEm: somarDias(hoje, -40),
      analisadoEm: somarDias(hoje, -36),
    },
    {
      id: 'd2',
      contratoId: 'c1',
      nome: 'Certidão Negativa de Débitos Trabalhistas',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'cndt-andrade-montagens.pdf',
      enviadoEm: somarDias(hoje, -38),
      analisadoEm: somarDias(hoje, -34),
    },
    {
      id: 'd3',
      contratoId: 'c1',
      nome: 'Relatório fotográfico final',
      obrigatorio: false,
      status: 'aprovado',
      arquivoNome: 'relatorio-fotografico-final.pdf',
      enviadoEm: somarDias(hoje, -38),
      analisadoEm: somarDias(hoje, -33),
    },

    // C2 — documento pendente
    {
      id: 'd4',
      contratoId: 'c2',
      nome: 'Certidão Negativa de Débitos Trabalhistas',
      obrigatorio: true,
      status: 'pendente',
    },
    {
      id: 'd5',
      contratoId: 'c2',
      nome: 'Apólice de seguro de risco de engenharia',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'apolice-risco-engenharia.pdf',
      enviadoEm: somarDias(hoje, -120),
      analisadoEm: somarDias(hoje, -117),
    },
    {
      id: 'd6',
      contratoId: 'c2',
      nome: 'Relatório de comissionamento do trecho',
      obrigatorio: true,
      status: 'enviado',
      arquivoNome: 'comissionamento-trecho-2.pdf',
      enviadoEm: somarDias(hoje, -6),
    },

    // C3 — documento rejeitado com justificativa
    {
      id: 'd7',
      contratoId: 'c3',
      nome: 'ART de execução da obra',
      obrigatorio: true,
      status: 'rejeitado',
      arquivoNome: 'art-execucao-v1.pdf',
      enviadoEm: somarDias(hoje, -22),
      analisadoEm: somarDias(hoje, -18),
      motivoRejeicao:
        'A ART enviada está sem a assinatura do responsável técnico e sem o número de registro no CREA. Reenviar a via assinada e com registro válido.',
    },
    {
      id: 'd8',
      contratoId: 'c3',
      nome: 'Relatório de comissionamento',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'comissionamento-ete-jardim.pdf',
      enviadoEm: somarDias(hoje, -30),
      analisadoEm: somarDias(hoje, -27),
    },

    // C4 — tudo aprovado, aguardando apenas a data mínima
    {
      id: 'd9',
      contratoId: 'c4',
      nome: 'Termo de aceite provisório',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'aceite-provisorio-bloco-a.pdf',
      enviadoEm: somarDias(hoje, -50),
      analisadoEm: somarDias(hoje, -46),
    },
    {
      id: 'd10',
      contratoId: 'c4',
      nome: 'Certidão Negativa de Débitos Trabalhistas',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'cndt-andrade-bloco-a.pdf',
      enviadoEm: somarDias(hoje, -49),
      analisadoEm: somarDias(hoje, -45),
    },

    // C5 — documentos aprovados; bloqueio vem da disputa
    {
      id: 'd11',
      contratoId: 'c5',
      nome: 'Termo de aceite da entrega',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'aceite-trecho-4.pdf',
      enviadoEm: somarDias(hoje, -30),
      analisadoEm: somarDias(hoje, -26),
    },
    {
      id: 'd12',
      contratoId: 'c5',
      nome: 'Certidão Negativa de Débitos Trabalhistas',
      obrigatorio: true,
      status: 'aprovado',
      arquivoNome: 'cndt-vertax.pdf',
      enviadoEm: somarDias(hoje, -31),
      analisadoEm: somarDias(hoje, -28),
    },
  ]

  const disputas: Disputa[] = [
    {
      id: 'dp1',
      contratoId: 'c5',
      descricao:
        'Divergência sobre o volume de material drenante medido no trecho 4B. A fiscalização aponta 1.200 m³ e a contratada apresentou 1.480 m³.',
      abertaEm: somarDias(hoje, -12),
      status: 'aberta',
    },
  ]

  // Lançamentos de rendimento já existentes (últimos dois meses fechados).
  // O contrato c1 fica sem lançamentos de propósito: serve de exemplo ao vivo na apresentação.
  const rendimentos: LancamentoRendimento[] = []
  const contratosComRendimento: Array<[string, number]> = [
    ['c2', 3_000_000 + 2_500_000],
    ['c3', 1_000_000 + 750_000],
    ['c4', 5_600_000 + 4_200_000],
    ['c5', 4_000_000 + 3_500_000],
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

  const historico: EventoHistorico[] = []
  let seqEvento = 0
  const evento = (
    contratoId: string,
    tipo: EventoHistorico['tipo'],
    descricao: string,
    perfil: EventoHistorico['perfil'],
    diasAtras: number,
  ) => {
    seqEvento += 1
    historico.push({
      id: `h${seqEvento}`,
      contratoId,
      tipo,
      descricao,
      perfil,
      data: dataHora(diasAtras, 9 + (seqEvento % 8)),
    })
  }

  for (const c of contratos) {
    evento(c.id, 'contrato_criado', `Contrato ${c.codigo} cadastrado na plataforma.`, 'contratante', 400)
  }
  evento('c1', 'medicao_registrada', 'Medição 01 registrada no valor de R$ 100.000,00 (retenção de R$ 5.000,00).', 'contratante', 75)
  evento('c1', 'deposito_confirmado', 'Depósito simulado da retenção da Medição 01 confirmado.', 'contratante', 73)
  evento('c1', 'documento_enviado', 'Documento "Termo de aceite definitivo da obra" enviado.', 'contratada', 40)
  evento('c1', 'documento_aprovado', 'Documento "Termo de aceite definitivo da obra" aprovado.', 'contratante', 36)
  evento('c1', 'entrega_aceita', 'Aceite da entrega registrado pela contratante.', 'contratante', 35)

  evento('c2', 'medicao_registrada', 'Medição 03 registrada no valor de R$ 180.000,00 (retenção de R$ 18.000,00).', 'contratante', 25)
  evento('c2', 'documento_enviado', 'Documento "Relatório de comissionamento do trecho" enviado.', 'contratada', 6)

  evento('c3', 'documento_enviado', 'Documento "ART de execução da obra" enviado.', 'contratada', 22)
  evento('c3', 'documento_rejeitado', 'Documento "ART de execução da obra" rejeitado pela contratante.', 'contratante', 18)

  evento('c4', 'entrega_aceita', 'Aceite da entrega registrado pela contratante.', 'contratante', 45)

  evento('c5', 'disputa_aberta', 'Disputa registrada pela contratante sobre a medição do trecho 4B.', 'contratante', 12)

  historico.sort((a, b) => (a.data < b.data ? 1 : -1))

  return {
    versao: VERSAO_DADOS,
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

export { periodoAtual }
