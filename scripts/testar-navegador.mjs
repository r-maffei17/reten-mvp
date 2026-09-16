// Teste de ponta a ponta no navegador, sobre a build de produção servida localmente.
// Executar com: npm run build && npm run preview & ; node scripts/testar-navegador.mjs

import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const passos = []
let falhas = 0

function checar(descricao, condicao, extra = '') {
  passos.push({ descricao, ok: Boolean(condicao), extra })
  if (!condicao) falhas += 1
  console.log(`${condicao ? '  ok ' : 'FALHA'} — ${descricao}${extra ? ` (${extra})` : ''}`)
}

const normalizar = (t) => (t ?? '').replace(/ /g, ' ')

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } })
const pagina = await contexto.newPage()

const erros = []
pagina.on('pageerror', (e) => erros.push(String(e)))
pagina.on('console', (m) => {
  if (m.type() === 'error') erros.push(m.text())
})

async function irPara(rota) {
  await pagina.goto(`${BASE}#${rota}`)
  await pagina.waitForTimeout(250)
}

try {
  // ---------------------------------------------------------------- 1. carga
  await irPara('/contratante')
  checar('Painel da contratante abre', await pagina.locator('h1', { hasText: 'Painel da contratante' }).isVisible())
  checar(
    'Faixa identifica o ambiente de demonstração',
    (await pagina.locator('.faixa-demo').innerText()).includes('dados e movimentações fictícios'),
  )
  checar('Seletor de perfis presente', (await pagina.locator('.seletor-perfil button').count()) === 3)

  // ---------------------------------------------------------------- 2. rendimento
  await irPara('/contratante/contratos')
  await pagina.getByRole('row', { name: /CT-2024-001/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(200)
  checar('Detalhe do contrato CT-2024-001 abre', await pagina.locator('h1', { hasText: 'Subestação Norte' }).isVisible())
  checar(
    'Contrato de referência aparece como elegível',
    (await pagina.locator('.etiqueta').first().innerText()).includes('Elegível'),
  )

  await pagina.getByRole('tab', { name: 'Medições e retenções' }).click()
  const linhaMedicao = normalizar(await pagina.getByRole('row', { name: /Medição 01/ }).innerText())
  checar(
    'Medição de R$ 100.000,00 mostra retenção de R$ 5.000,00 e restante de R$ 95.000,00',
    linhaMedicao.includes('R$ 100.000,00') && linhaMedicao.includes('R$ 5.000,00') && linhaMedicao.includes('R$ 95.000,00'),
    linhaMedicao.replace(/\s+/g, ' ').slice(0, 120),
  )

  await pagina.getByRole('tab', { name: 'Extrato financeiro' }).click()
  await pagina.getByRole('button', { name: /Simular próximo mês/ }).click()
  await pagina.waitForTimeout(300)
  const extrato = normalizar(await pagina.locator('.painel-corpo').last().innerText())
  checar(
    'Rendimento simulado: bruto R$ 40,00, plataforma R$ 4,00, contratada R$ 36,00',
    extrato.includes('R$ 40,00') && extrato.includes('R$ 4,00') && extrato.includes('R$ 36,00'),
  )
  checar('Saldo para liberação vira R$ 5.036,00', extrato.includes('R$ 5.036,00'))

  // Segundo clique avança o período, sem duplicar
  await pagina.getByRole('button', { name: /Simular próximo mês/ }).click()
  await pagina.waitForTimeout(300)
  const linhasExtrato = await pagina.locator('table.tabela tbody tr').count()
  checar('Segundo clique cria um novo período (2 lançamentos + linha de totais)', linhasExtrato === 3, `linhas=${linhasExtrato}`)

  // ---------------------------------------------------------------- 3. persistência
  await pagina.reload()
  await pagina.waitForTimeout(400)
  await pagina.getByRole('tab', { name: 'Extrato financeiro' }).click()
  await pagina.waitForTimeout(200)
  const apos = normalizar(await pagina.locator('.painel-corpo').last().innerText())
  checar('Lançamentos continuam após atualizar a página', apos.includes('R$ 72,00') || apos.includes('R$ 36,00'))

  // ---------------------------------------------------------------- 4. bloqueio por disputa
  await irPara('/contratante/contratos')
  await pagina.getByRole('row', { name: /CT-2025-031/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  const textoDisputa = await pagina.locator('.aviso-disputa').innerText()
  checar('Contrato com disputa exibe o aviso de bloqueio', textoDisputa.includes('Disputa em aberto'))
  const checklistDisputa = await pagina.locator('.checklist li.pendente').allInnerTexts()
  checar(
    'Checklist aponta exatamente a condição que falta (disputa)',
    checklistDisputa.length === 1 && checklistDisputa[0].includes('Sem disputa em aberto'),
    `${checklistDisputa.length} pendência(s)`,
  )

  // ---------------------------------------------------------------- 5. documento: envio, rejeição, reenvio, aprovação
  await irPara('/contratada')
  await pagina.waitForTimeout(250)
  await pagina.selectOption('#seletor-contratada', { label: 'Norte Sul Construções Ltda.' })
  await pagina.waitForTimeout(250)
  await irPara('/contratada/contratos')
  await pagina.getByRole('row', { name: /CT-2025-014/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()

  const linhaCndt = pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
  await linhaCndt.getByRole('button', { name: 'Simular envio' }).click()
  await pagina.waitForTimeout(300)
  checar('Envio simulado muda o status para Enviado', (await linhaCndt.innerText()).includes('Enviado'))
  checar('Nome de arquivo fictício gerado', (await linhaCndt.innerText()).includes('.pdf'))

  await irPara('/contratante/contratos')
  await pagina.getByRole('row', { name: /CT-2025-014/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  const linhaCndtCtt = pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
  await linhaCndtCtt.getByRole('button', { name: 'Rejeitar' }).click()
  await pagina.waitForTimeout(200)

  // Rejeição sem justificativa deve ser barrada
  await pagina.getByRole('button', { name: 'Rejeitar documento' }).click()
  await pagina.waitForTimeout(200)
  checar('Rejeição sem justificativa mostra erro de campo obrigatório', await pagina.locator('.erro-campo').first().isVisible())

  await pagina.locator('#motivo-rejeicao').fill('Certidão vencida. Reenviar a via atualizada e assinada.')
  await pagina.getByRole('button', { name: 'Rejeitar documento' }).click()
  await pagina.waitForTimeout(300)
  checar('Documento fica Rejeitado com a justificativa visível', (await linhaCndtCtt.innerText()).includes('Certidão vencida'))

  await irPara('/contratada/contratos')
  await pagina.getByRole('row', { name: /CT-2025-014/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  const linhaReenvio = pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
  await linhaReenvio.getByRole('button', { name: 'Reenviar documento' }).click()
  await pagina.waitForTimeout(300)
  checar('Reenvio volta o documento para Enviado', (await linhaReenvio.innerText()).includes('Enviado'))

  await irPara('/contratante/contratos')
  await pagina.getByRole('row', { name: /CT-2025-014/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  const linhaAprovar = pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
  await linhaAprovar.getByRole('button', { name: 'Aprovar' }).click()
  await pagina.waitForTimeout(300)
  checar('Aprovação muda o status para Aprovado', (await linhaAprovar.innerText()).includes('Aprovado'))

  // ---------------------------------------------------------------- 6. liberação: solicitar e confirmar
  await irPara('/contratada')
  await pagina.selectOption('#seletor-contratada', { label: 'Andrade Montagens Ltda.' })
  await pagina.waitForTimeout(250)
  await irPara('/contratada/contratos')
  await pagina.getByRole('row', { name: /CT-2024-001/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('button', { name: 'Solicitar liberação' }).click()
  await pagina.waitForTimeout(200)
  const textoConfirmacao = normalizar(await pagina.locator('.modal-corpo').innerText())
  checar('Diálogo de confirmação mostra o valor a liberar', textoConfirmacao.includes('R$ 5.072,00'), textoConfirmacao.slice(0, 90))
  await pagina.getByRole('button', { name: 'Solicitar liberação' }).last().click()
  await pagina.waitForTimeout(400)
  checar('Status vira "Liberação solicitada"', (await pagina.locator('.etiqueta').first().innerText()).includes('solicitada'))

  await irPara('/contratante/contratos')
  await pagina.getByRole('row', { name: /CT-2024-001/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('button', { name: 'Confirmar liberação simulada' }).click()
  await pagina.waitForTimeout(200)
  await pagina.getByRole('button', { name: 'Confirmar liberação' }).last().click()
  await pagina.waitForTimeout(400)

  const blocoLiberado = normalizar(await pagina.locator('.aviso-sucesso-bloco').innerText())
  checar('Aviso de contrato liberado aparece com o total', blocoLiberado.includes('R$ 5.072,00'), blocoLiberado.slice(0, 100))

  const resumoLiberado = normalizar(await pagina.locator('.definicoes').first().innerText())
  checar('Saldo retido zerado após a liberação', resumoLiberado.includes('R$ 0,00'))
  checar('Total liberado preservado no resumo', resumoLiberado.includes('R$ 5.072,00'))
  checar(
    'Liberação duplicada impedida: botão de confirmar some',
    (await pagina.getByRole('button', { name: 'Confirmar liberação simulada' }).count()) === 0,
  )
  checar(
    'Contrato liberado não aceita novas medições',
    (await pagina.getByRole('button', { name: '+ Registrar medição' }).count()) === 0,
  )

  await pagina.getByRole('tab', { name: 'Extrato financeiro' }).click()
  await pagina.waitForTimeout(200)
  const extratoFinal = normalizar(await pagina.locator('.painel-corpo').last().innerText())
  checar('Extrato preservado após a liberação', extratoFinal.includes('R$ 36,00'))
  checar(
    'Sem novos rendimentos após a liberação',
    (await pagina.getByRole('button', { name: /Simular próximo mês/ }).count()) === 0,
  )

  await pagina.getByRole('tab', { name: 'Histórico' }).click()
  await pagina.waitForTimeout(200)
  const historico = normalizar(await pagina.locator('.linha-tempo').innerText())
  checar('Histórico registra a liberação', historico.includes('Liberação simulada confirmada'))

  // ---------------------------------------------------------------- 7. cadastro de contrato e validações
  await irPara('/contratante/contratos/novo')
  await pagina.getByRole('button', { name: 'Cadastrar contrato' }).last().click()
  await pagina.waitForTimeout(250)
  const errosVisiveis = await pagina.locator('.erro-campo').count()
  checar('Formulário vazio mostra erros de campos obrigatórios', errosVisiveis >= 2, `${errosVisiveis} erros`)

  await pagina.locator('#nome').fill('Contrato de teste do grupo')
  await pagina.locator('#codigo').fill('CT-2026-099')
  await pagina.locator('#valor-total').fill('2.000.000,00')
  await pagina.locator('#percentual').fill('150')
  await pagina.getByRole('button', { name: 'Cadastrar contrato' }).last().click()
  await pagina.waitForTimeout(250)
  checar(
    'Percentual acima de 100 é recusado',
    (await pagina.locator('.erro-campo').allInnerTexts()).some((t) => t.includes('entre 0 e 100')),
  )

  await pagina.locator('#percentual').fill('10')
  await pagina.getByRole('button', { name: 'Cadastrar contrato' }).last().click()
  await pagina.waitForTimeout(400)
  checar(
    'Contrato válido é cadastrado e aparece na lista',
    normalizar(await pagina.locator('table.tabela').innerText()).includes('CT-2026-099'),
  )

  // Medição acima do valor do contrato
  await pagina.getByRole('row', { name: /CT-2026-099/ }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('tab', { name: 'Medições e retenções' }).click()
  await pagina.getByRole('button', { name: '+ Registrar medição' }).click()
  await pagina.waitForTimeout(200)
  await pagina.locator('#med-descricao').fill('Medição 01')
  await pagina.locator('#med-valor').fill('3.000.000,00')
  await pagina.waitForTimeout(150)
  const previa = normalizar(await pagina.locator('.modal-corpo .nota').innerText())
  checar('Prévia do cálculo mostra retenção de R$ 300.000,00', previa.includes('R$ 300.000,00'), previa.replace(/\s+/g, ' ').slice(0, 110))
  await pagina.getByRole('button', { name: 'Registrar medição' }).last().click()
  await pagina.waitForTimeout(250)
  checar(
    'Medição acima do valor do contrato é recusada',
    (await pagina.locator('.erro-campo').allInnerTexts()).some((t) => t.includes('ultrapassar o valor do contrato')),
  )
  await pagina.locator('#med-valor').fill('500.000,00')
  await pagina.getByRole('button', { name: 'Registrar medição' }).last().click()
  await pagina.waitForTimeout(400)
  const linhaNova = normalizar(await pagina.getByRole('row', { name: /Medição 01/ }).innerText())
  checar('Medição válida registra retenção de R$ 50.000,00', linhaNova.includes('R$ 50.000,00'))

  // Sem depósito confirmado, não há rendimento
  await pagina.getByRole('tab', { name: 'Extrato financeiro' }).click()
  await pagina.getByRole('button', { name: /Simular próximo mês/ }).click()
  await pagina.waitForTimeout(300)
  checar(
    'Sem depósito confirmado a simulação é recusada com mensagem clara',
    (await pagina.locator('.aviso.erro').innerText()).includes('principal depositado'),
  )

  // ---------------------------------------------------------------- 8. plataforma
  await irPara('/plataforma')
  await pagina.waitForTimeout(300)
  // Os rótulos dos cartões são exibidos em maiúsculas pelo CSS; comparamos sem diferenciar caixa.
  const painelPlataformaOriginal = normalizar(await pagina.locator('.grade-indicadores').innerText())
  const painelPlataforma = painelPlataformaOriginal.toLowerCase()
  checar('Painel da plataforma mostra contratantes cadastradas', painelPlataforma.includes('contratantes cadastradas'))
  checar(
    'Receita de assinaturas projetada mensal = 2 × R$ 499,00',
    painelPlataformaOriginal.includes('R$ 998,00'),
  )
  checar(
    'Receitas mensal e acumulada são apresentadas separadamente',
    painelPlataforma.includes('projeção mensal') && painelPlataforma.includes('acumulado'),
  )

  await irPara('/plataforma/configuracoes')
  await pagina.waitForTimeout(250)
  await pagina.locator('#taxa').fill('300')
  await pagina.getByRole('button', { name: 'Salvar parâmetros' }).click()
  await pagina.waitForTimeout(250)
  checar('Taxa fora de 0–100 é recusada', (await pagina.locator('.erro-campo').first().innerText()).includes('entre 0 e 100'))
  await pagina.locator('#taxa').fill('0,8')
  await pagina.getByRole('button', { name: 'Salvar parâmetros' }).click()
  await pagina.waitForTimeout(250)
  checar('Parâmetros válidos são salvos', (await pagina.locator('.aviso.sucesso').count()) > 0)

  // ---------------------------------------------------------------- 9. restaurar demonstração
  await irPara('/sobre')
  await pagina.waitForTimeout(250)
  await pagina.getByRole('button', { name: '↺ Restaurar demonstração' }).first().click()
  await pagina.waitForTimeout(200)
  checar('Restauração pede confirmação', await pagina.locator('.fundo-modal').isVisible())
  await pagina.getByRole('button', { name: 'Sim, restaurar' }).click()
  await pagina.waitForTimeout(400)
  await irPara('/contratante/contratos')
  await pagina.waitForTimeout(300)
  // A busca é feita dentro da tabela: um aviso antigo na tela não deve contar como resultado.
  const tabelaRestaurada = normalizar(await pagina.locator('table.tabela').innerText())
  checar('Após restaurar, o contrato de teste sumiu da lista', !tabelaRestaurada.includes('CT-2026-099'))
  checar('Após restaurar, voltam os 5 contratos de exemplo', (await pagina.locator('table.tabela tbody tr').count()) === 5)
  const linhaRestaurada = normalizar(await pagina.getByRole('row', { name: /CT-2024-001/ }).innerText())
  checar('Após restaurar, o contrato de referência volta a R$ 5.000,00 retidos', linhaRestaurada.includes('R$ 5.000,00'))

  // ---------------------------------------------------------------- 10. responsivo
  await contexto.clearCookies()
  const celular = await navegador.newContext({ viewport: { width: 390, height: 844 } })
  const paginaCelular = await celular.newPage()
  await paginaCelular.goto(`${BASE}#/contratante`)
  await paginaCelular.waitForTimeout(400)
  checar('No celular o menu aparece recolhido com botão de abrir', await paginaCelular.locator('.botao-menu').isVisible())
  await paginaCelular.locator('.botao-menu').click()
  await paginaCelular.waitForTimeout(300)
  checar('Botão abre o menu lateral no celular', await paginaCelular.locator('.menu-lateral.aberto').isVisible())
  const larguraDocumento = await paginaCelular.evaluate(() => document.documentElement.scrollWidth)
  checar('Sem rolagem horizontal no celular', larguraDocumento <= 400, `scrollWidth=${larguraDocumento}`)
  await celular.close()

  checar('Nenhum erro de JavaScript no console durante o fluxo', erros.length === 0, erros.slice(0, 2).join(' | '))
} catch (e) {
  console.error('\nErro durante a execução:', e)
  falhas += 1
} finally {
  await navegador.close()
}

console.log(`\n${passos.length - falhas}/${passos.length} verificações passaram.`)
process.exit(falhas > 0 ? 1 : 0)
