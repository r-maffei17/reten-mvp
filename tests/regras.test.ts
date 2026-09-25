// Testes das regras financeiras, de elegibilidade, do módulo financeiro opcional,
// do ciclo de documentos e da importação de cauções.
// Executar com: npm test

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  abrirDisputa,
  aceitarEntrega,
  aprovarDocumento,
  confirmarDeposito,
  confirmarLiberacao,
  confirmarRecebimento,
  definirDataSimulacao,
  definirPlano,
  enviarDocumento,
  importarCaucoes,
  registrarMedicao,
  rejeitarDocumento,
  resolverDisputa,
  salvarConfiguracoes,
  simularProximoMes,
  solicitarLiberacao,
  type ResultadoAcao,
} from '../src/domain/acoes'
import {
  calcularDataMinimaLiberacao,
  calcularRendimento,
  calcularResumoContrato,
  calcularRetencao,
} from '../src/domain/calculos'
import { CSV_EXEMPLO, lerCsvCaucoes } from '../src/domain/csv'
import {
  CONTRATO_PADRAO,
  criarDadosIniciais,
  DATA_SIMULACAO_INICIAL,
} from '../src/domain/dadosIniciais'
import { proximoPeriodo, somarDias } from '../src/domain/datas'
import { avaliarLiberacaoDoEstado } from '../src/domain/elegibilidade'
import { formatarMoeda, textoParaCents } from '../src/domain/money'
import { IMPLANTACAO, planoIndicado, PLANOS } from '../src/domain/planos'
import { calcularTotaisPlataforma, listarPendenciasContratada } from '../src/domain/selecoes'
import type { EstadoDemo } from '../src/domain/types'
import { validarContrato, validarMedicao } from '../src/domain/validacoes'

/** O Intl usa espaço não separável depois de "R$"; normalizamos para comparar. */
function moeda(cents: number): string {
  return formatarMoeda(cents).replace(/ /g, ' ')
}

function aplicar(estado: EstadoDemo, resultado: ResultadoAcao): EstadoDemo {
  assert.equal(resultado.ok, true, `ação falhou: ${resultado.mensagem}`)
  return (resultado as Extract<ResultadoAcao, { ok: true }>).estado
}

function contratoPorCodigo(estado: EstadoDemo, codigo: string) {
  const c = estado.contratos.find((x) => x.codigo === codigo)
  assert.ok(c, `contrato ${codigo} não encontrado`)
  return c
}

const PADRAO = CONTRATO_PADRAO.codigo

// ------------------------------------------------------------------ cálculos

test('retenção: R$ 100.000,00 a 5% resulta em R$ 5.000,00', () => {
  assert.equal(calcularRetencao(10_000_000, 5), 500_000)
  assert.equal(moeda(calcularRetencao(10_000_000, 5)), 'R$ 5.000,00')
})

test('rendimento: exemplo de referência (R$ 5.000, 0,8%, 10%)', () => {
  const r = calcularRendimento(500_000, 0.8, 10)
  assert.equal(r.rendimentoBrutoCents, 4000)
  assert.equal(r.receitaPlataformaCents, 400)
  assert.equal(r.rendimentoContratadaCents, 3600)
  assert.equal(r.receitaPlataformaCents + r.rendimentoContratadaCents, r.rendimentoBrutoCents)
})

test('rendimento: a soma das partes nunca perde centavos no arredondamento', () => {
  for (const principal of [1, 7, 333, 12_345, 999_999, 7_777_777]) {
    const r = calcularRendimento(principal, 0.8, 10)
    assert.equal(r.receitaPlataformaCents + r.rendimentoContratadaCents, r.rendimentoBrutoCents)
  }
})

test('prazo: 60 dias corridos a partir do dia seguinte a 01/06/2026 caem em 31/07/2026', () => {
  assert.equal(calcularDataMinimaLiberacao('2026-06-01', 60), '2026-07-31')
  assert.equal(CONTRATO_PADRAO.dataMinimaLiberacao, '2026-07-31')
})

test('conversão de texto para centavos aceita o formato brasileiro', () => {
  assert.equal(textoParaCents('100.000,00'), 10_000_000)
  assert.equal(textoParaCents('0,01'), 1)
  assert.equal(textoParaCents('abc'), null)
})

// ------------------------------------------------------------------ planos

test('planos: preços de 2.500, 5.000 e a partir de 10.000, com implantação de 10 a 30 mil', () => {
  const [essencial, profissional, corporativo] = PLANOS
  assert.equal(essencial.precoMensalCents, 250_000)
  assert.equal(essencial.limiteContratos, 15)
  assert.equal(profissional.precoMensalCents, 500_000)
  assert.equal(profissional.limiteContratos, 50)
  assert.equal(corporativo.precoMensalCents, 1_000_000)
  assert.equal(corporativo.limiteContratos, null)
  assert.equal(corporativo.aPartirDe, true)
  assert.equal(IMPLANTACAO.minimoCents, 1_000_000)
  assert.equal(IMPLANTACAO.maximoCents, 3_000_000)
})

test('planos: nenhuma menção a R$ 499 sobreviveu no domínio', () => {
  const estado = criarDadosIniciais()
  assert.equal('mensalidadeCents' in estado.configuracoes, false)
  const serializado = JSON.stringify({ estado, PLANOS, IMPLANTACAO })
  assert.equal(serializado.includes('49900'), false)
  assert.equal(serializado.includes('499,00'), false)
})

test('planos: a faixa indica o plano conforme o volume de contratos', () => {
  assert.equal(planoIndicado(1).id, 'essencial')
  assert.equal(planoIndicado(15).id, 'essencial')
  assert.equal(planoIndicado(16).id, 'profissional')
  assert.equal(planoIndicado(50).id, 'profissional')
  assert.equal(planoIndicado(51).id, 'corporativo')
})

test('receita mensal de assinaturas soma as mensalidades dos planos contratados', () => {
  let estado = criarDadosIniciais()
  // Profissional (5.000) + Essencial (2.500) = 7.500
  let totais = calcularTotaisPlataforma(estado, estado.dataSimulacao.slice(0, 7))
  assert.equal(totais.receitaAssinaturasMensalCents, 750_000)
  assert.equal(totais.receitaAssinaturasEhPiso, false)

  estado = aplicar(estado, definirPlano(estado, 'ct2', 'corporativo'))
  totais = calcularTotaisPlataforma(estado, estado.dataSimulacao.slice(0, 7))
  assert.equal(totais.receitaAssinaturasMensalCents, 1_500_000)
  assert.equal(totais.receitaAssinaturasEhPiso, true)
})

// ------------------------------------------------------------------ contrato de teste padrão

test('contrato padrão: R$ 100.000 medidos, 5%, R$ 5.000 retidos, prazo em 31/07/2026', () => {
  const estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, PADRAO)

  assert.equal(contrato.valorTotalCents, 10_000_000)
  assert.equal(contrato.percentualRetencao, 5)
  assert.equal(contrato.dataConclusao, '2026-06-01')
  assert.equal(contrato.entregaAceitaEm, '2026-06-01')
  assert.equal(contrato.prazoDiasCorridos, 60)
  assert.equal(contrato.dataMinimaLiberacao, '2026-07-31')
  assert.equal(contrato.moduloFinanceiroAtivo, false)

  const resumo = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(resumo.totalMedidoCents, 10_000_000)
  assert.equal(resumo.saldoAMedirCents, 0)
  assert.equal(resumo.principalRetidoCents, 500_000)
  assert.equal(moeda(resumo.saldoParaLiberacaoCents), 'R$ 5.000,00')
})

test('data da simulação: 30/07/2026 bloqueia e 31/07/2026 torna elegível', () => {
  let estado = criarDadosIniciais()
  assert.equal(estado.dataSimulacao, DATA_SIMULACAO_INICIAL)
  assert.equal(DATA_SIMULACAO_INICIAL, '2026-07-30')

  let avaliacao = avaliarLiberacaoDoEstado(estado, contratoPorCodigo(estado, PADRAO))
  assert.equal(avaliacao.status, 'bloqueada')
  assert.deepEqual(avaliacao.pendencias.map((p) => p.chave), ['prazo'])

  estado = aplicar(estado, definirDataSimulacao(estado, '2026-07-31'))
  avaliacao = avaliarLiberacaoDoEstado(estado, contratoPorCodigo(estado, PADRAO))
  assert.equal(avaliacao.status, 'elegivel')
  assert.equal(avaliacao.pendencias.length, 0)
})

test('contrato padrão: o conjunto de travas é o previsto, sem trava de depósito', () => {
  const estado = criarDadosIniciais()
  const avaliacao = avaliarLiberacaoDoEstado(estado, contratoPorCodigo(estado, PADRAO))
  assert.deepEqual(avaliacao.condicoes.map((c) => c.chave), [
    'documentos',
    'entrega',
    'prazo',
    'sem_disputa',
    'saldo',
  ])
})

test('contrato padrão: cada trava, sozinha, bloqueia a solicitação', () => {
  // Ponto de partida: tudo cumprido na data em que o prazo vence.
  const base = () => {
    const inicial = criarDadosIniciais()
    return aplicar(inicial, definirDataSimulacao(inicial, '2026-07-31'))
  }

  assert.equal(avaliarLiberacaoDoEstado(base(), contratoPorCodigo(base(), PADRAO)).status, 'elegivel')

  const cenarios: Array<[string, (e: EstadoDemo) => EstadoDemo, string]> = [
    [
      'documentos',
      (e) => ({
        ...e,
        documentos: e.documentos.map((d) =>
          d.id === 'd0b' ? { ...d, status: 'pendente' as const } : d,
        ),
      }),
      'documentos',
    ],
    [
      'entrega',
      (e) => ({
        ...e,
        contratos: e.contratos.map((c) =>
          c.codigo === PADRAO ? { ...c, entregaAceita: false, entregaAceitaEm: undefined } : c,
        ),
      }),
      'entrega',
    ],
    ['prazo', (e) => aplicar(e, definirDataSimulacao(e, '2026-07-30')), 'prazo'],
    [
      'disputa',
      (e) => aplicar(e, abrirDisputa(e, contratoPorCodigo(e, PADRAO).id, 'Divergência de quantitativo.')),
      'sem_disputa',
    ],
    [
      'saldo',
      (e) => ({ ...e, medicoes: e.medicoes.filter((m) => m.contratoId !== 'c0') }),
      'saldo',
    ],
  ]

  for (const [nome, quebrar, chaveEsperada] of cenarios) {
    const estado = quebrar(base())
    const contrato = contratoPorCodigo(estado, PADRAO)
    const avaliacao = avaliarLiberacaoDoEstado(estado, contrato)

    assert.equal(avaliacao.status, 'bloqueada', `cenário "${nome}" deveria bloquear`)
    assert.deepEqual(
      avaliacao.pendencias.map((p) => p.chave),
      [chaveEsperada],
      `cenário "${nome}" deveria apontar somente ${chaveEsperada}`,
    )

    const solicitacao = solicitarLiberacao(estado, contrato.id)
    assert.equal(solicitacao.ok, false, `cenário "${nome}" deveria impedir a solicitação`)
    assert.match(solicitacao.mensagem, /bloqueada/i)
  }
})

test('contrato padrão: fluxo completo de liberação na data do prazo', () => {
  let estado = criarDadosIniciais()
  estado = aplicar(estado, definirDataSimulacao(estado, '2026-07-31'))
  const contrato = contratoPorCodigo(estado, PADRAO)

  estado = aplicar(estado, solicitarLiberacao(estado, contrato.id))
  estado = aplicar(estado, confirmarLiberacao(estado, contrato.id))

  const liberado = contratoPorCodigo(estado, PADRAO)
  assert.equal(liberado.liberadoEm, '2026-07-31')
  assert.equal(liberado.liberacao?.totalCents, 500_000)
  assert.equal(liberado.liberacao?.rendimentoContratadaCents, 0)

  const resumo = calcularResumoContrato(liberado, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(resumo.saldoParaLiberacaoCents, 0)
  assert.equal(resumo.totalLiberadoCents, 500_000)

  assert.equal(confirmarLiberacao(estado, contrato.id).ok, false)
  assert.equal(solicitarLiberacao(estado, contrato.id).ok, false)
})

// ------------------------------------------------------------------ módulo financeiro opcional

test('sem módulo financeiro: retenção entra no saldo sem etapa de depósito', () => {
  const estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, PADRAO)
  const medicao = estado.medicoes.find((m) => m.contratoId === contrato.id)!

  assert.equal(medicao.depositoConfirmado, false)
  const resumo = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(resumo.principalRetidoCents, 500_000)
  assert.equal(resumo.principalAguardandoDepositoCents, 0)
  assert.equal(resumo.medicoesPendentesDeposito, 0)
  assert.equal(resumo.principalElegivelRendimentoCents, 0)

  // Depósito e rendimento não se aplicam.
  const deposito = confirmarDeposito(estado, medicao.id)
  assert.equal(deposito.ok, false)
  assert.match(deposito.mensagem, /não tem módulo financeiro/i)

  const rendimento = simularProximoMes(estado, contrato.id)
  assert.equal(rendimento.ok, false)
  assert.match(rendimento.mensagem, /não tem módulo financeiro/i)
})

test('sem módulo financeiro: nenhum rendimento ou participação é gerado', () => {
  const estado = criarDadosIniciais()
  const semModulo = estado.contratos.filter((c) => !c.moduloFinanceiroAtivo)
  assert.ok(semModulo.length >= 1, 'falta contrato sem módulo financeiro')
  const comModulo = estado.contratos.filter((c) => c.moduloFinanceiroAtivo)
  assert.ok(comModulo.length >= 1, 'falta contrato com módulo financeiro')

  for (const c of semModulo) {
    assert.equal(
      estado.rendimentos.some((r) => r.contratoId === c.id),
      false,
      `contrato ${c.codigo} não deveria ter rendimentos`,
    )
  }
})

test('com módulo financeiro: só o principal depositado rende', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2025-014')
  assert.equal(contrato.moduloFinanceiroAtivo, true)

  const antes = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(antes.principalElegivelRendimentoCents, 5_500_000)
  assert.equal(antes.principalAguardandoDepositoCents, 1_800_000)

  const semDeposito = estado.medicoes.find((m) => m.contratoId === contrato.id && !m.depositoConfirmado)!
  estado = aplicar(estado, confirmarDeposito(estado, semDeposito.id))
  const depois = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(depois.principalElegivelRendimentoCents, 7_300_000)
})

test('com módulo financeiro: rendimento mensal, sem duplicar período e sem capitalizar', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')

  estado = aplicar(estado, simularProximoMes(estado, contrato.id))
  let lancamentos = estado.rendimentos.filter((r) => r.contratoId === contrato.id)
  assert.equal(lancamentos.length, 1)
  assert.equal(lancamentos[0].periodo, DATA_SIMULACAO_INICIAL.slice(0, 7))
  assert.equal(lancamentos[0].principalBaseCents, 500_000)
  assert.equal(lancamentos[0].rendimentoBrutoCents, 4000)
  assert.equal(lancamentos[0].receitaPlataformaCents, 400)
  assert.equal(lancamentos[0].rendimentoContratadaCents, 3600)

  const resumoUmMes = calcularResumoContrato(
    contratoPorCodigo(estado, 'CT-2024-001'),
    estado.medicoes,
    estado.documentos,
    estado.rendimentos,
  )
  assert.equal(moeda(resumoUmMes.saldoParaLiberacaoCents), 'R$ 5.036,00')

  estado = aplicar(estado, simularProximoMes(estado, contrato.id))
  lancamentos = estado.rendimentos
    .filter((r) => r.contratoId === contrato.id)
    .sort((a, b) => (a.periodo < b.periodo ? -1 : 1))
  assert.equal(lancamentos.length, 2)
  assert.equal(lancamentos[1].periodo, proximoPeriodo(DATA_SIMULACAO_INICIAL.slice(0, 7)))
  assert.equal(lancamentos[1].principalBaseCents, 500_000) // sem capitalização
})

test('alterar a taxa não recalcula lançamentos anteriores', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')

  estado = aplicar(estado, simularProximoMes(estado, contrato.id))
  const primeiro = estado.rendimentos.find((r) => r.contratoId === contrato.id)!

  estado = aplicar(
    estado,
    salvarConfiguracoes(estado, { ...estado.configuracoes, taxaMensalPercentual: 1.5 }),
  )
  estado = aplicar(estado, simularProximoMes(estado, contrato.id))

  const preservado = estado.rendimentos.find((r) => r.id === primeiro.id)!
  assert.equal(preservado.taxaMensalPercentual, 0.8)
  assert.equal(preservado.rendimentoBrutoCents, 4000)

  const novo = estado.rendimentos
    .filter((r) => r.contratoId === contrato.id)
    .sort((a, b) => (a.periodo < b.periodo ? -1 : 1))[1]
  assert.equal(novo.taxaMensalPercentual, 1.5)
  assert.equal(novo.rendimentoBrutoCents, 7500)
})

// ------------------------------------------------------------------ documentos

test('documento: envio, recebimento, recusa com motivo, reenvio e aprovação', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2025-014')
  const doc = estado.documentos.find((d) => d.contratoId === contrato.id && d.status === 'pendente')!

  assert.equal(doc.versaoAtual, 0)
  assert.equal(doc.versoes.length, 0)
  assert.equal(aprovarDocumento(estado, doc.id).ok, false)

  // Envio: cria a versão 1.
  estado = aplicar(estado, enviarDocumento(estado, doc.id))
  let atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'enviado')
  assert.equal(atual.versaoAtual, 1)
  assert.equal(atual.versoes.length, 1)
  assert.equal(atual.versoes[0].resultado, 'em_analise')
  assert.equal(atual.recebidoEm, undefined)

  // Confirmação de recebimento, com data e responsável.
  estado = aplicar(estado, confirmarRecebimento(estado, doc.id))
  atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.recebidoEm, estado.dataSimulacao)
  assert.ok(atual.recebidoPor)
  assert.equal(atual.versoes[0].recebidoEm, estado.dataSimulacao)
  assert.equal(confirmarRecebimento(estado, doc.id).ok, false)

  // Recusa exige motivo e registra data e responsável.
  assert.equal(rejeitarDocumento(estado, doc.id, '   ').ok, false)
  estado = aplicar(estado, rejeitarDocumento(estado, doc.id, 'Certidão vencida; reenviar a via atual.'))
  atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'rejeitado')
  assert.equal(atual.motivoRejeicao, 'Certidão vencida; reenviar a via atual.')
  assert.equal(atual.analisadoEm, estado.dataSimulacao)
  assert.ok(atual.analisadoPor)
  assert.equal(atual.versoes[0].resultado, 'rejeitado')
  assert.equal(atual.versoes[0].motivoRejeicao, 'Certidão vencida; reenviar a via atual.')

  // Reenvio cria a versão 2 e preserva a versão 1 no histórico.
  estado = aplicar(estado, enviarDocumento(estado, doc.id))
  atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'enviado')
  assert.equal(atual.versaoAtual, 2)
  assert.equal(atual.versoes.length, 2)
  assert.equal(atual.versoes[0].resultado, 'rejeitado')
  assert.equal(atual.versoes[0].motivoRejeicao, 'Certidão vencida; reenviar a via atual.')
  assert.equal(atual.motivoRejeicao, undefined)
  assert.equal(atual.recebidoEm, undefined)

  // Aprovar sem confirmar recebimento carimba o recebimento junto.
  estado = aplicar(estado, aprovarDocumento(estado, doc.id))
  atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'aprovado')
  assert.ok(atual.recebidoEm)
  assert.equal(atual.versoes[1].resultado, 'aprovado')
  assert.ok(atual.versoes[1].analisadoPor)
})

test('documento recusado nos dados iniciais traz motivo, data e responsável', () => {
  const estado = criarDadosIniciais()
  const recusado = estado.documentos.find((d) => d.status === 'rejeitado')!
  assert.ok(recusado.motivoRejeicao && recusado.motivoRejeicao.length > 20)
  assert.ok(recusado.analisadoEm)
  assert.ok(recusado.analisadoPor)
  assert.equal(recusado.versoes.at(-1)?.motivoRejeicao, recusado.motivoRejeicao)
})

test('pendências da contratada trazem responsável, motivo e prazo', () => {
  const estado = criarDadosIniciais()
  const contratoRecusado = contratoPorCodigo(estado, 'CT-2025-022')
  const pendencias = listarPendenciasContratada(estado, contratoRecusado.contratadaId)

  assert.ok(pendencias.length > 0)
  for (const p of pendencias) {
    assert.ok(p.responsavel && p.responsavel.length > 0, 'pendência sem responsável')
    assert.ok(p.motivo && p.motivo.length > 0, 'pendência sem motivo')
  }

  const reenvio = pendencias.find((p) => p.titulo.startsWith('Reenviar documento'))
  assert.ok(reenvio, 'falta a pendência de reenvio do documento recusado')
  assert.match(reenvio.motivo, /Recusado em/)
  assert.ok(reenvio.prazo, 'a pendência de reenvio deveria ter prazo')
})

// ------------------------------------------------------------------ importação de cauções

test('CSV: o arquivo de exemplo é lido sem erros', () => {
  const leitura = lerCsvCaucoes(CSV_EXEMPLO)
  assert.equal(leitura.erroGeral, undefined)
  assert.equal(leitura.validas.length, 3)
  assert.equal(leitura.linhas.filter((l) => l.erro).length, 0)

  const primeira = leitura.validas[0]
  assert.equal(primeira.contrato, 'CT-ERP-101')
  assert.equal(primeira.valorMedidoCents, 25_000_000)
  assert.equal(primeira.percentual, 5)
  assert.equal(primeira.valorRetidoCents, 1_250_000)
  assert.equal(primeira.vencimento, '2026-11-30')
})

test('CSV: colunas faltando param a importação', () => {
  const leitura = lerCsvCaucoes('contrato;fornecedor\nX;Y')
  assert.ok(leitura.erroGeral)
  assert.match(leitura.erroGeral, /valor medido/)
})

test('CSV: cada linha inválida é ignorada com o motivo', () => {
  const texto = [
    'contrato;fornecedor;valor medido;percentual;valor retido;vencimento',
    'CT-1;Fornecedor A;100.000,00;5;5.000,00;30/11/2026', // válida
    'CT-2;Fornecedor B;100.000,00;150;5.000,00;30/11/2026', // percentual > 100
    'CT-3;Fornecedor C;100.000,00;5;9.999,00;30/11/2026', // retido não confere
    'CT-4;Fornecedor D;100.000,00;5;5.000,00;31/02/2026', // data inexistente
    ';Fornecedor E;100.000,00;5;5.000,00;30/11/2026', // contrato em branco
    'CT-1;Fornecedor F;50.000,00;5;2.500,00;30/11/2026', // código repetido
  ].join('\n')

  const leitura = lerCsvCaucoes(texto)
  assert.equal(leitura.validas.length, 1)
  const erros = leitura.linhas.filter((l) => l.erro)
  assert.equal(erros.length, 5)
  assert.match(erros[0].erro!, /entre 0 e 100/)
  assert.match(erros[1].erro!, /não confere/)
  assert.match(erros[2].erro!, /Vencimento inválido/)
  assert.match(erros[3].erro!, /em branco/)
  assert.match(erros[4].erro!, /repetido/)
})

test('importação cria contratos, medições e fornecedores novos', () => {
  let estado = criarDadosIniciais()
  const contratosAntes = estado.contratos.length
  const contratadasAntes = estado.contratadas.length
  const leitura = lerCsvCaucoes(CSV_EXEMPLO)

  estado = aplicar(
    estado,
    importarCaucoes(estado, leitura.validas, { contratanteId: 'ct1', moduloFinanceiroAtivo: false }),
  )

  assert.equal(estado.contratos.length, contratosAntes + 3)
  // "Hidrotec Saneamento Ltda." ainda não existia; as outras duas já existiam.
  assert.equal(estado.contratadas.length, contratadasAntes + 1)

  const importado = contratoPorCodigo(estado, 'CT-ERP-101')
  assert.equal(importado.origem, 'erp')
  assert.equal(importado.percentualRetencao, 5)
  assert.equal(importado.dataMinimaLiberacao, '2026-11-30')
  assert.equal(importado.moduloFinanceiroAtivo, false)

  const resumo = calcularResumoContrato(importado, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(resumo.totalMedidoCents, 25_000_000)
  assert.equal(resumo.principalRetidoCents, 1_250_000)

  // Reimportar o mesmo arquivo é recusado por código duplicado.
  const repetida = importarCaucoes(estado, leitura.validas, {
    contratanteId: 'ct1',
    moduloFinanceiroAtivo: false,
  })
  assert.equal(repetida.ok, false)
  assert.match(repetida.mensagem, /Já existe contrato/)
})

// ------------------------------------------------------------------ dados iniciais

test('dados iniciais cobrem as situações do roteiro', () => {
  const estado = criarDadosIniciais()
  assert.equal(estado.contratantes.length, 2)
  assert.equal(estado.contratadas.length, 3)
  assert.ok(estado.contratos.length >= 5)

  assert.ok(estado.documentos.some((d) => d.status === 'pendente'), 'falta documento pendente')
  assert.ok(estado.documentos.some((d) => d.status === 'enviado'), 'falta documento em análise')
  assert.ok(
    estado.documentos.some((d) => d.status === 'rejeitado' && d.motivoRejeicao),
    'falta documento recusado com motivo',
  )
  assert.ok(estado.disputas.some((d) => d.status === 'aberta'), 'falta disputa em aberto')

  const bloqueadoSoPorPrazo = estado.contratos.filter((c) => {
    const a = avaliarLiberacaoDoEstado(estado, c)
    return a.pendencias.length === 1 && a.pendencias[0].chave === 'prazo'
  })
  assert.ok(bloqueadoSoPorPrazo.length >= 1, 'falta contrato bloqueado apenas pelo prazo')

  const elegiveis = estado.contratos.filter(
    (c) => avaliarLiberacaoDoEstado(estado, c).status === 'elegivel',
  )
  assert.deepEqual(elegiveis.map((c) => c.codigo), ['CT-2024-001'])

  // Documento com mais de uma versão, para mostrar o histórico.
  assert.ok(
    estado.documentos.some((d) => d.versoes.length > 1),
    'falta documento com histórico de versões',
  )
})

test('a marca antiga não aparece mais nos dados', () => {
  const serializado = JSON.stringify(criarDadosIniciais())
  assert.equal(/\bReten\b/.test(serializado), false)
})

// ------------------------------------------------------------------ liberação e revalidação

test('a confirmação revalida: disputa aberta depois da solicitação bloqueia', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  estado = aplicar(estado, solicitarLiberacao(estado, contrato.id))
  estado = aplicar(estado, abrirDisputa(estado, contrato.id, 'Divergência identificada depois.'))

  const resultado = confirmarLiberacao(estado, contrato.id)
  assert.equal(resultado.ok, false)
  assert.match(resultado.mensagem, /revalida/i)
})

test('resolver a disputa torna o contrato elegível', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2025-031')
  const disputa = estado.disputas.find((d) => d.contratoId === contrato.id && d.status === 'aberta')!
  estado = aplicar(estado, resolverDisputa(estado, disputa.id, 'Quantitativo revisado e aceito.'))
  assert.equal(avaliarLiberacaoDoEstado(estado, contratoPorCodigo(estado, 'CT-2025-031')).status, 'elegivel')
})

test('contrato liberado não aceita novas movimentações', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  estado = aplicar(estado, solicitarLiberacao(estado, contrato.id))
  estado = aplicar(estado, confirmarLiberacao(estado, contrato.id))

  assert.equal(simularProximoMes(estado, contrato.id).ok, false)
  assert.equal(
    registrarMedicao(estado, contrato.id, {
      descricao: 'Nova',
      data: estado.dataSimulacao,
      valorCents: 1000,
    }).ok,
    false,
  )
  assert.equal(abrirDisputa(estado, contrato.id, 'Tentativa após liberação.').ok, false)
  assert.equal(aceitarEntrega(estado, contrato.id).ok, false)

  const doc = estado.documentos.find((d) => d.contratoId === contrato.id)!
  assert.equal(enviarDocumento(estado, doc.id).ok, false)
})

// ------------------------------------------------------------------ validações

test('medição: valor positivo e limitado ao saldo do contrato', () => {
  const estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  const base = { descricao: 'Medição 02', data: contrato.dataInicio }

  assert.ok(
    validarMedicao({ ...base, valorCents: -100 }, contrato, estado.medicoes, estado.documentos, estado.rendimentos)
      .valor,
  )
  assert.ok(
    validarMedicao({ ...base, valorCents: 95_000_000 }, contrato, estado.medicoes, estado.documentos, estado.rendimentos)
      .valor,
  )
  assert.deepEqual(
    validarMedicao({ ...base, valorCents: 50_000_000 }, contrato, estado.medicoes, estado.documentos, estado.rendimentos),
    {},
  )
  assert.equal(registrarMedicao(estado, contrato.id, { ...base, valorCents: 95_000_000 }).ok, false)
})

test('contrato: percentual fora de 0–100, campos obrigatórios e datas incoerentes', () => {
  const estado = criarDadosIniciais()
  const validos = {
    nome: 'Contrato novo',
    codigo: 'CT-NOVO-001',
    contratanteId: estado.contratantes[0].id,
    contratadaId: estado.contratadas[0].id,
    valorTotalCents: 10_000_000,
    percentualRetencao: 5,
    dataInicio: '2026-01-01',
    dataTermino: '2026-12-31',
    dataMinimaLiberacao: '2027-03-01',
    condicoesLiberacao: 'Condições descritas.',
  }
  assert.deepEqual(validarContrato(validos, estado.contratos), {})

  assert.ok(validarContrato({ ...validos, percentualRetencao: 101 }, estado.contratos).percentualRetencao)
  assert.ok(validarContrato({ ...validos, percentualRetencao: -1 }, estado.contratos).percentualRetencao)
  assert.ok(validarContrato({ ...validos, valorTotalCents: 0 }, estado.contratos).valorTotal)
  assert.ok(validarContrato({ ...validos, nome: '  ' }, estado.contratos).nome)
  assert.ok(validarContrato({ ...validos, dataTermino: '2025-01-01' }, estado.contratos).dataTermino)
  assert.ok(validarContrato({ ...validos, prazoDiasCorridos: -5 }, estado.contratos).prazoDiasCorridos)
  assert.ok(validarContrato({ ...validos, codigo: PADRAO }, estado.contratos).codigo)
})

test('a data da simulação recusa formatos inválidos', () => {
  const estado = criarDadosIniciais()
  assert.equal(definirDataSimulacao(estado, '31/07/2026').ok, false)
  assert.equal(definirDataSimulacao(estado, '2026-07-31').ok, true)
})

test('as datas gravadas seguem a data da simulação, não o relógio', () => {
  let estado = criarDadosIniciais()
  estado = aplicar(estado, definirDataSimulacao(estado, '2026-09-10'))
  const contrato = contratoPorCodigo(estado, 'CT-2025-014')
  const doc = estado.documentos.find((d) => d.contratoId === contrato.id && d.status === 'pendente')!

  estado = aplicar(estado, enviarDocumento(estado, doc.id))
  const atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.enviadoEm, '2026-09-10')
  assert.match(atual.arquivoNome!, /20260910/)
  assert.equal(somarDias(atual.enviadoEm!, 0), '2026-09-10')
})
