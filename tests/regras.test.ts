// Testes das regras financeiras, de elegibilidade e do fluxo de liberação.
// Executar com: npm test

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  abrirDisputa,
  aceitarEntrega,
  aprovarDocumento,
  confirmarDeposito,
  confirmarLiberacao,
  enviarDocumento,
  registrarMedicao,
  rejeitarDocumento,
  resolverDisputa,
  salvarConfiguracoes,
  simularProximoMes,
  solicitarLiberacao,
  type ResultadoAcao,
} from '../src/domain/acoes'
import { calcularRendimento, calcularResumoContrato, calcularRetencao } from '../src/domain/calculos'
import { criarDadosIniciais } from '../src/domain/dadosIniciais'
import { periodoAtual, proximoPeriodo, somarDias } from '../src/domain/datas'
import { avaliarLiberacaoDoEstado } from '../src/domain/elegibilidade'
import { formatarMoeda, textoParaCents } from '../src/domain/money'
import type { EstadoDemo } from '../src/domain/types'
import { validarContrato, validarMedicao } from '../src/domain/validacoes'

/** O Intl usa espaço não separável depois de "R$"; normalizamos para comparar. */
function moeda(cents: number): string {
  return formatarMoeda(cents).replace(/\u00A0/g, ' ')
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

// ------------------------------------------------------------------ cálculos

test('retenção: R$ 100.000,00 a 5% resulta em R$ 5.000,00', () => {
  assert.equal(calcularRetencao(10_000_000, 5), 500_000)
  assert.equal(moeda(calcularRetencao(10_000_000, 5)), 'R$ 5.000,00')
})

test('retenção: percentual 0 não retém nada', () => {
  assert.equal(calcularRetencao(10_000_000, 0), 0)
})

test('rendimento: exemplo de referência do enunciado (R$ 5.000, 0,8%, 10%)', () => {
  const r = calcularRendimento(500_000, 0.8, 10)
  assert.equal(r.rendimentoBrutoCents, 4000) // R$ 40,00
  assert.equal(r.receitaPlataformaCents, 400) // R$ 4,00
  assert.equal(r.rendimentoContratadaCents, 3600) // R$ 36,00
  assert.equal(r.receitaPlataformaCents + r.rendimentoContratadaCents, r.rendimentoBrutoCents)
})

test('rendimento: a soma das partes nunca perde centavos no arredondamento', () => {
  for (const principal of [1, 7, 333, 12_345, 999_999, 7_777_777]) {
    const r = calcularRendimento(principal, 0.8, 10)
    assert.equal(r.receitaPlataformaCents + r.rendimentoContratadaCents, r.rendimentoBrutoCents)
  }
})

test('conversão de texto para centavos aceita o formato brasileiro', () => {
  assert.equal(textoParaCents('1.000.000,00'), 100_000_000)
  assert.equal(textoParaCents('100.000,00'), 10_000_000)
  assert.equal(textoParaCents('0,01'), 1)
  assert.equal(textoParaCents('abc'), null)
  assert.equal(textoParaCents(''), null)
})

// ------------------------------------------------------------------ dados iniciais

test('dados iniciais trazem 2 contratantes, 3 contratadas e 5 contratos', () => {
  const estado = criarDadosIniciais()
  assert.equal(estado.contratantes.length, 2)
  assert.equal(estado.contratadas.length, 3)
  assert.equal(estado.contratos.length, 5)
})

test('dados iniciais incluem o contrato de R$ 1 milhão com R$ 5.000 retidos', () => {
  const estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  assert.equal(contrato.valorTotalCents, 100_000_000)
  assert.equal(contrato.percentualRetencao, 5)

  const medicoes = estado.medicoes.filter((m) => m.contratoId === contrato.id)
  assert.equal(medicoes.length, 1)
  assert.equal(medicoes[0].valorCents, 10_000_000)
  assert.equal(medicoes[0].retencaoCents, 500_000)

  const resumo = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(resumo.principalDepositadoCents, 500_000)
})

test('dados iniciais cobrem as cinco situações pedidas', () => {
  const estado = criarDadosIniciais()

  const comPendente = estado.documentos.some((d) => d.status === 'pendente')
  const comRejeitado = estado.documentos.some((d) => d.status === 'rejeitado' && d.motivoRejeicao)
  assert.ok(comPendente, 'falta contrato com documento pendente')
  assert.ok(comRejeitado, 'falta documento rejeitado com justificativa')

  const aguardandoData = estado.contratos.some((c) => {
    const a = avaliarLiberacaoDoEstado(estado, c)
    return a.pendencias.length === 1 && a.pendencias[0].chave === 'data_minima'
  })
  assert.ok(aguardandoData, 'falta contrato bloqueado apenas pela data mínima')

  assert.ok(estado.disputas.some((d) => d.status === 'aberta'), 'falta disputa em aberto')

  const elegivel = estado.contratos.filter((c) => avaliarLiberacaoDoEstado(estado, c).status === 'elegivel')
  assert.equal(elegivel.length, 1)
  assert.equal(elegivel[0].codigo, 'CT-2024-001')
})

// ------------------------------------------------------------------ elegibilidade

test('cada bloqueio aponta exatamente a condição que falta', () => {
  const estado = criarDadosIniciais()

  const comDisputa = contratoPorCodigo(estado, 'CT-2025-031')
  const avaliacaoDisputa = avaliarLiberacaoDoEstado(estado, comDisputa)
  assert.equal(avaliacaoDisputa.status, 'bloqueada')
  assert.deepEqual(avaliacaoDisputa.pendencias.map((p) => p.chave), ['sem_disputa'])

  const aguardandoData = contratoPorCodigo(estado, 'CT-2026-003')
  const avaliacaoData = avaliarLiberacaoDoEstado(estado, aguardandoData)
  assert.deepEqual(avaliacaoData.pendencias.map((p) => p.chave), ['data_minima'])

  const comRejeitado = contratoPorCodigo(estado, 'CT-2025-022')
  const avaliacaoDoc = avaliarLiberacaoDoEstado(estado, comRejeitado)
  const chaves = avaliacaoDoc.pendencias.map((p) => p.chave)
  assert.ok(chaves.includes('documentos'))
  assert.ok(chaves.includes('entrega'))
})

test('resolver a disputa torna o contrato elegível', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2025-031')
  const disputa = estado.disputas.find((d) => d.contratoId === contrato.id && d.status === 'aberta')!
  estado = aplicar(estado, resolverDisputa(estado, disputa.id, 'Quantitativo revisado e aceito.'))
  assert.equal(avaliarLiberacaoDoEstado(estado, contratoPorCodigo(estado, 'CT-2025-031')).status, 'elegivel')
})

// ------------------------------------------------------------------ documentos

test('fluxo do documento: envio, rejeição com justificativa, reenvio e aprovação', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2025-014')
  const doc = estado.documentos.find((d) => d.contratoId === contrato.id && d.status === 'pendente')!

  // Só é possível aprovar/rejeitar o que foi enviado.
  assert.equal(aprovarDocumento(estado, doc.id).ok, false)
  assert.equal(rejeitarDocumento(estado, doc.id, 'motivo suficiente').ok, false)

  estado = aplicar(estado, enviarDocumento(estado, doc.id))
  let atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'enviado')
  assert.ok(atual.arquivoNome?.endsWith('.pdf'))

  // Rejeição sem justificativa é recusada.
  assert.equal(rejeitarDocumento(estado, doc.id, '   ').ok, false)

  estado = aplicar(estado, rejeitarDocumento(estado, doc.id, 'Certidão vencida; reenviar a via atual.'))
  atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'rejeitado')
  assert.equal(atual.motivoRejeicao, 'Certidão vencida; reenviar a via atual.')

  estado = aplicar(estado, enviarDocumento(estado, doc.id))
  atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'enviado')
  assert.equal(atual.motivoRejeicao, undefined)

  estado = aplicar(estado, aprovarDocumento(estado, doc.id))
  atual = estado.documentos.find((d) => d.id === doc.id)!
  assert.equal(atual.status, 'aprovado')
})

// ------------------------------------------------------------------ rendimentos

test('simular próximo mês: um lançamento por período, avançando um mês por clique', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')

  estado = aplicar(estado, simularProximoMes(estado, contrato.id))
  let lancamentos = estado.rendimentos.filter((r) => r.contratoId === contrato.id)
  assert.equal(lancamentos.length, 1)
  assert.equal(lancamentos[0].periodo, periodoAtual())
  assert.equal(lancamentos[0].principalBaseCents, 500_000)
  assert.equal(lancamentos[0].rendimentoBrutoCents, 4000)
  assert.equal(lancamentos[0].receitaPlataformaCents, 400)
  assert.equal(lancamentos[0].rendimentoContratadaCents, 3600)

  estado = aplicar(estado, simularProximoMes(estado, contrato.id))
  lancamentos = estado.rendimentos
    .filter((r) => r.contratoId === contrato.id)
    .sort((a, b) => (a.periodo < b.periodo ? -1 : 1))
  assert.equal(lancamentos.length, 2)
  assert.equal(lancamentos[1].periodo, proximoPeriodo(periodoAtual()))

  // Sem capitalização: a base do segundo mês continua sendo o principal.
  assert.equal(lancamentos[1].principalBaseCents, 500_000)

  const resumo = calcularResumoContrato(
    contratoPorCodigo(estado, 'CT-2024-001'),
    estado.medicoes,
    estado.documentos,
    estado.rendimentos,
  )
  assert.equal(resumo.rendimentoContratadaAcumuladoCents, 7200)
  assert.equal(resumo.saldoParaLiberacaoCents, 507_200)
})

test('saldo para liberação após um mês é R$ 5.036,00 no contrato de referência', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  estado = aplicar(estado, simularProximoMes(estado, contrato.id))
  const resumo = calcularResumoContrato(
    contratoPorCodigo(estado, 'CT-2024-001'),
    estado.medicoes,
    estado.documentos,
    estado.rendimentos,
  )
  assert.equal(moeda(resumo.saldoParaLiberacaoCents), 'R$ 5.036,00')
})

test('rendimento só incide sobre retenções com depósito confirmado', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2025-014')
  const semDeposito = estado.medicoes.find((m) => m.contratoId === contrato.id && !m.depositoConfirmado)!

  const antes = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(antes.principalElegivelRendimentoCents, 5_500_000)

  estado = aplicar(estado, confirmarDeposito(estado, semDeposito.id))
  const depois = calcularResumoContrato(contrato, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(depois.principalElegivelRendimentoCents, 7_300_000)
})

test('alterar a taxa não recalcula lançamentos anteriores', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')

  estado = aplicar(estado, simularProximoMes(estado, contrato.id))
  const primeiro = estado.rendimentos.find((r) => r.contratoId === contrato.id)!
  assert.equal(primeiro.taxaMensalPercentual, 0.8)
  assert.equal(primeiro.rendimentoBrutoCents, 4000)

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
  assert.equal(novo.rendimentoBrutoCents, 7500) // 500.000 × 1,5%
})

test('sem principal depositado não há rendimento a simular', () => {
  const estado = criarDadosIniciais()
  const novo = criarContratoVazio(estado)
  const resultado = simularProximoMes(novo.estado, novo.contratoId)
  assert.equal(resultado.ok, false)
  assert.match(resultado.mensagem, /principal depositado/i)
})

function criarContratoVazio(estadoBase: EstadoDemo) {
  const estado: EstadoDemo = {
    ...estadoBase,
    contratos: [
      ...estadoBase.contratos,
      {
        id: 'contrato-vazio',
        codigo: 'CT-TESTE-001',
        nome: 'Contrato sem medições',
        contratanteId: estadoBase.contratantes[0].id,
        contratadaId: estadoBase.contratadas[0].id,
        valorTotalCents: 10_000_000,
        percentualRetencao: 5,
        dataInicio: somarDias(new Date().toISOString().slice(0, 10), -30),
        dataTermino: somarDias(new Date().toISOString().slice(0, 10), 300),
        dataMinimaLiberacao: somarDias(new Date().toISOString().slice(0, 10), 330),
        condicoesLiberacao: 'Condições de teste.',
        entregaAceita: false,
        criadoEm: new Date().toISOString(),
      },
    ],
  }
  return { estado, contratoId: 'contrato-vazio' }
}

// ------------------------------------------------------------------ liberação

test('liberação bloqueada não pode ser solicitada', () => {
  const estado = criarDadosIniciais()
  const comDisputa = contratoPorCodigo(estado, 'CT-2025-031')
  const resultado = solicitarLiberacao(estado, comDisputa.id)
  assert.equal(resultado.ok, false)
  assert.match(resultado.mensagem, /disputa/i)
})

test('fluxo completo: solicitar, confirmar, zerar saldo e impedir duplicidade', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')

  estado = aplicar(estado, simularProximoMes(estado, contrato.id))

  // A contratante não pode confirmar antes da solicitação.
  assert.equal(confirmarLiberacao(estado, contrato.id).ok, false)

  estado = aplicar(estado, solicitarLiberacao(estado, contrato.id))
  assert.equal(avaliarLiberacaoDoEstado(estado, contratoPorCodigo(estado, 'CT-2024-001')).status, 'solicitada')

  // Solicitação duplicada é recusada.
  assert.equal(solicitarLiberacao(estado, contrato.id).ok, false)

  estado = aplicar(estado, confirmarLiberacao(estado, contrato.id))
  const liberado = contratoPorCodigo(estado, 'CT-2024-001')
  assert.ok(liberado.liberadoEm)
  assert.equal(liberado.liberacao?.principalCents, 500_000)
  assert.equal(liberado.liberacao?.rendimentoContratadaCents, 3600)
  assert.equal(liberado.liberacao?.totalCents, 503_600)

  const resumo = calcularResumoContrato(liberado, estado.medicoes, estado.documentos, estado.rendimentos)
  assert.equal(resumo.principalRetidoCents, 0)
  assert.equal(resumo.rendimentoRetidoCents, 0)
  assert.equal(resumo.saldoParaLiberacaoCents, 0)
  assert.equal(resumo.totalLiberadoCents, 503_600)

  // O extrato é preservado.
  assert.equal(estado.rendimentos.filter((r) => r.contratoId === contrato.id).length, 1)

  // Liberação duplicada é impedida.
  assert.equal(confirmarLiberacao(estado, contrato.id).ok, false)
  assert.equal(solicitarLiberacao(estado, contrato.id).ok, false)
})

test('contrato liberado não aceita novas movimentações', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  estado = aplicar(estado, solicitarLiberacao(estado, contrato.id))
  estado = aplicar(estado, confirmarLiberacao(estado, contrato.id))

  assert.equal(simularProximoMes(estado, contrato.id).ok, false)
  assert.equal(
    registrarMedicao(estado, contrato.id, { descricao: 'Nova', data: periodoAtual() + '-01', valorCents: 1000 }).ok,
    false,
  )
  assert.equal(abrirDisputa(estado, contrato.id, 'Tentativa após liberação.').ok, false)
  assert.equal(aceitarEntrega(estado, contrato.id).ok, false)

  const doc = estado.documentos.find((d) => d.contratoId === contrato.id)!
  assert.equal(enviarDocumento(estado, doc.id).ok, false)
})

test('a confirmação revalida as condições: disputa aberta depois da solicitação bloqueia', () => {
  let estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  estado = aplicar(estado, solicitarLiberacao(estado, contrato.id))
  estado = aplicar(estado, abrirDisputa(estado, contrato.id, 'Divergência identificada após a solicitação.'))

  const resultado = confirmarLiberacao(estado, contrato.id)
  assert.equal(resultado.ok, false)
  assert.match(resultado.mensagem, /revalida/i)
})

// ------------------------------------------------------------------ validações

test('medição: valor positivo e limitado ao saldo do contrato', () => {
  const estado = criarDadosIniciais()
  const contrato = contratoPorCodigo(estado, 'CT-2024-001')
  const base = { descricao: 'Medição 02', data: contrato.dataInicio }

  const negativa = validarMedicao(
    { ...base, valorCents: -100 },
    contrato,
    estado.medicoes,
    estado.documentos,
    estado.rendimentos,
  )
  assert.ok(negativa.valor)

  const acimaDoContrato = validarMedicao(
    { ...base, valorCents: 95_000_000 },
    contrato,
    estado.medicoes,
    estado.documentos,
    estado.rendimentos,
  )
  assert.ok(acimaDoContrato.valor)

  const valida = validarMedicao(
    { ...base, valorCents: 50_000_000 },
    contrato,
    estado.medicoes,
    estado.documentos,
    estado.rendimentos,
  )
  assert.deepEqual(valida, {})

  // A ação também recusa, mesmo que a validação do formulário seja contornada.
  assert.equal(
    registrarMedicao(estado, contrato.id, { ...base, valorCents: 95_000_000 }).ok,
    false,
  )
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
  assert.ok(
    validarContrato({ ...validos, dataMinimaLiberacao: '2025-06-01' }, estado.contratos)
      .dataMinimaLiberacao,
  )
  assert.ok(validarContrato({ ...validos, codigo: 'CT-2024-001' }, estado.contratos).codigo)
})
