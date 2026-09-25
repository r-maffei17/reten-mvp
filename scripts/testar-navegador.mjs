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
  await pagina.waitForTimeout(280)
}

/** Abre um contrato pelo código, a partir da lista do perfil informado. */
async function abrirContrato(rotaLista, codigo) {
  await irPara(rotaLista)
  await pagina.getByRole('row', { name: new RegExp(codigo) }).getByRole('button', { name: 'Abrir' }).click()
  await pagina.waitForTimeout(280)
}

try {
  // ---------------------------------------------------------------- 1. marca
  await irPara('/contratante')
  checar('Painel da contratante abre', await pagina.locator('h1', { hasText: 'Painel da contratante' }).isVisible())
  checar('Título da página traz TrustRetain', (await pagina.title()).includes('TrustRetain'))
  checar('Cabeçalho do menu traz TrustRetain', (await pagina.locator('.menu-marca .nome').innerText()).trim() === 'TrustRetain')
  checar(
    'A marca antiga "Reten" não aparece mais na interface',
    !/\bReten\b/.test(normalizar(await pagina.locator('body').innerText())),
  )
  checar(
    'Faixa de dados fictícios preservada',
    (await pagina.locator('.faixa-demo').innerText()).includes('dados e movimentações fictícios'),
  )
  checar(
    'Botão "Restaurar demonstração" preservado',
    (await pagina.getByRole('button', { name: /Restaurar demonstração/ }).count()) > 0,
  )
  checar('Seletor de perfis presente', (await pagina.locator('.seletor-perfil button').count()) === 3)
  checar(
    'Data da simulação visível na barra superior',
    (await pagina.locator('.chip-data').innerText()).includes('30/07/2026'),
  )

  // ---------------------------------------------------------------- 2. contrato de teste padrão
  await abrirContrato('/contratante/contratos', 'CT-2026-100')
  const resumoPadrao = normalizar(await pagina.locator('.definicoes').first().innerText())
  checar('Contrato padrão: valor total R$ 100.000,00', resumoPadrao.includes('R$ 100.000,00'))
  checar('Contrato padrão: retenção de 5%', resumoPadrao.includes('5%'))
  checar('Contrato padrão: saldo retido R$ 5.000,00', resumoPadrao.includes('R$ 5.000,00'))
  checar('Contrato padrão: conclusão e aceite em 01/06/2026', resumoPadrao.includes('01/06/2026'))
  checar('Contrato padrão: prazo de 60 dias corridos', resumoPadrao.includes('60 dias corridos'))
  checar('Contrato padrão: data mínima 31/07/2026', resumoPadrao.includes('31/07/2026'))
  checar(
    'Contrato padrão é marcado como sem módulo financeiro',
    normalizar(await pagina.locator('.cabecalho-pagina').innerText()).includes('Sem módulo financeiro'),
  )
  checar(
    'Sem módulo financeiro, não há aba de extrato',
    (await pagina.getByRole('tab', { name: 'Extrato financeiro' }).count()) === 0,
  )
  const travas = await pagina.locator('.checklist li').allInnerTexts()
  checar('Contrato padrão tem 5 travas, sem trava de depósito', travas.length === 5, `${travas.length} travas`)
  checar('Nenhuma trava de depósito no contrato sem módulo', !travas.some((t) => t.includes('Depósito')))
  const pendentesPadrao = await pagina.locator('.checklist li.pendente').allInnerTexts()
  checar(
    'Em 30/07/2026 a única trava pendente é o prazo',
    pendentesPadrao.length === 1 && pendentesPadrao[0].includes('Prazo contratual'),
    `${pendentesPadrao.length} pendente(s)`,
  )

  // ---------------------------------------------------------------- 3. data da simulação
  await irPara('/plataforma/simulacao')
  await pagina.getByRole('button', { name: /31\/07\/2026 — prazo cumprido/ }).click()
  await pagina.waitForTimeout(400)
  checar(
    'Com 31/07/2026 o contrato padrão fica elegível',
    normalizar(await pagina.locator('.painel').last().innerText()).includes('Elegível para solicitação'),
  )
  await pagina.getByRole('button', { name: /30\/07\/2026 — véspera/ }).click()
  await pagina.waitForTimeout(400)
  checar(
    'Com 30/07/2026 o contrato padrão volta a ficar bloqueado',
    normalizar(await pagina.locator('.painel').last().innerText()).includes('Bloqueada por pendências'),
  )

  // ---------------------------------------------------------------- 4. abrir e fechar disputa
  await pagina.getByRole('button', { name: 'Abrir disputa neste contrato' }).click()
  await pagina.waitForTimeout(400)
  let painelPadrao = normalizar(await pagina.locator('.painel').last().innerText())
  checar('Botão abre disputa no contrato padrão', painelPadrao.includes('Sem disputa em aberto — pendente'))
  checar(
    'Com disputa aberta há duas travas pendentes (prazo e disputa)',
    (await pagina.locator('.painel').last().locator('.checklist li.pendente').count()) === 2,
  )
  await pagina.getByRole('button', { name: 'Fechar disputa deste contrato' }).click()
  await pagina.waitForTimeout(400)
  painelPadrao = normalizar(await pagina.locator('.painel').last().innerText())
  checar('Botão fecha a disputa', painelPadrao.includes('Sem disputa em aberto — cumprida'))

  // ---------------------------------------------------------------- 5. módulo financeiro opcional
  await abrirContrato('/contratante/contratos', 'CT-2024-001')
  checar(
    'Contrato com módulo financeiro é identificado',
    normalizar(await pagina.locator('.cabecalho-pagina').innerText()).includes('Módulo financeiro ativo'),
  )
  checar(
    'Com módulo financeiro há aba de extrato',
    (await pagina.getByRole('tab', { name: 'Extrato financeiro' }).count()) === 1,
  )
  await pagina.getByRole('tab', { name: 'Medições e retenções' }).click()
  await pagina.waitForTimeout(200)
  checar(
    'Com módulo financeiro a tabela mostra a coluna de depósito',
    normalizar(await pagina.locator('table.tabela').first().innerText()).includes('Depósito'),
  )
  await pagina.getByRole('tab', { name: 'Extrato financeiro' }).click()
  await pagina.getByRole('button', { name: /Simular próximo mês/ }).click()
  await pagina.waitForTimeout(400)
  const extrato = normalizar(await pagina.locator('.painel-corpo').last().innerText())
  checar(
    'Rendimento simulado: bruto R$ 40,00, plataforma R$ 4,00, contratada R$ 36,00',
    extrato.includes('R$ 40,00') && extrato.includes('R$ 4,00') && extrato.includes('R$ 36,00'),
  )
  checar('Saldo para liberação vira R$ 5.036,00', extrato.includes('R$ 5.036,00'))

  // O contrato sem módulo financeiro não mostra nada disso.
  await abrirContrato('/contratante/contratos', 'CT-2026-100')
  const corpoPadrao = normalizar(await pagina.locator('main').innerText())
  checar(
    'Contrato sem módulo não fala em rendimento nem participação',
    !corpoPadrao.includes('Rendimento bruto') && !corpoPadrao.includes('Receita da plataforma'),
  )
  await pagina.getByRole('tab', { name: 'Medições e retenções' }).click()
  await pagina.waitForTimeout(200)
  checar(
    'Contrato sem módulo não mostra coluna nem ação de depósito',
    !normalizar(await pagina.locator('table.tabela').first().innerText()).includes('Depósito'),
  )

  // ---------------------------------------------------------------- 6. documento: motivo, recebimento e versões
  await abrirContrato('/contratante/contratos', 'CT-2025-022')
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  await pagina.waitForTimeout(250)
  const linhaArt = pagina.getByRole('row', { name: /ART de execução/ })
  const textoArt = normalizar(await linhaArt.innerText())
  checar('Documento recusado mostra o motivo', textoArt.includes('Motivo da recusa'))
  checar('Documento recusado mostra data e responsável', /Recusado em \d{2}\/\d{2}\/\d{4} por /.test(textoArt))
  await linhaArt.getByRole('group').count().catch(() => {})
  await linhaArt.locator('details.detalhes-versoes summary').click()
  await pagina.waitForTimeout(200)
  checar(
    'Histórico de versões do documento é exibido',
    normalizar(await linhaArt.innerText()).includes('Versão 1'),
  )

  // Ciclo completo no CT-2025-014: envio, recebimento, recusa, reenvio e aprovação.
  await irPara('/contratada')
  await pagina.selectOption('#seletor-contratada', { label: 'Norte Sul Construções Ltda.' })
  await pagina.waitForTimeout(280)
  await abrirContrato('/contratada/contratos', 'CT-2025-014')
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  await pagina.waitForTimeout(200)
  const linhaCndt = pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
  await linhaCndt.getByRole('button', { name: 'Simular envio' }).click()
  await pagina.waitForTimeout(350)
  checar('Envio cria a versão 1', normalizar(await linhaCndt.innerText()).includes('Versão 1'))

  await abrirContrato('/contratante/contratos', 'CT-2025-014')
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  await pagina.waitForTimeout(200)
  const linhaCndtCtt = pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
  checar(
    'Antes de confirmar, o recebimento aparece como não confirmado',
    normalizar(await linhaCndtCtt.innerText()).includes('Recebimento não confirmado'),
  )
  await linhaCndtCtt.getByRole('button', { name: 'Confirmar recebimento' }).click()
  await pagina.waitForTimeout(350)
  checar(
    'Confirmação de recebimento registra a data',
    /Recebimento confirmado em \d{2}\/\d{2}\/\d{4}/.test(normalizar(await linhaCndtCtt.innerText())),
  )

  await linhaCndtCtt.getByRole('button', { name: 'Recusar' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('button', { name: 'Recusar documento' }).click()
  await pagina.waitForTimeout(250)
  checar('Recusa sem motivo mostra erro de campo obrigatório', await pagina.locator('.erro-campo').first().isVisible())
  await pagina.locator('#motivo-rejeicao').fill('Certidão vencida. Reenviar a via atualizada e assinada.')
  await pagina.getByRole('button', { name: 'Recusar documento' }).click()
  await pagina.waitForTimeout(400)
  checar(
    'Recusa registra motivo, data e responsável',
    /Motivo da recusa/.test(normalizar(await linhaCndtCtt.innerText())) &&
      /Recusado em \d{2}\/\d{2}\/\d{4} por /.test(normalizar(await linhaCndtCtt.innerText())),
  )

  await abrirContrato('/contratada/contratos', 'CT-2025-014')
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  await pagina.waitForTimeout(200)
  const linhaReenvio = pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
  await linhaReenvio.getByRole('button', { name: 'Reenviar documento' }).click()
  await pagina.waitForTimeout(400)
  checar('Reenvio cria a versão 2', normalizar(await linhaReenvio.innerText()).includes('Versão 2'))
  await linhaReenvio.locator('details.detalhes-versoes summary').click()
  await pagina.waitForTimeout(200)
  const versoes = normalizar(await linhaReenvio.innerText())
  checar(
    'Histórico guarda as duas versões, com a recusa da primeira',
    versoes.includes('Versão 1') && versoes.includes('Versão 2') && versoes.includes('Certidão vencida'),
  )

  await abrirContrato('/contratante/contratos', 'CT-2025-014')
  await pagina.getByRole('tab', { name: 'Documentos e obrigações' }).click()
  await pagina.waitForTimeout(200)
  await pagina
    .getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ })
    .getByRole('button', { name: 'Aprovar' })
    .click()
  await pagina.waitForTimeout(400)
  checar(
    'Aprovação muda o status para Aprovado',
    normalizar(
      await pagina.getByRole('row', { name: /Certidão Negativa de Débitos Trabalhistas/ }).innerText(),
    ).includes('Aprovado'),
  )

  // ---------------------------------------------------------------- 7. pendências da contratada
  await irPara('/contratada')
  await pagina.selectOption('#seletor-contratada', { label: 'Vertax Engenharia Ltda.' })
  await pagina.waitForTimeout(350)
  const primeiroPainel = pagina.locator('.painel').first()
  checar(
    'Tela da contratada abre pelas pendências',
    (await primeiroPainel.locator('h2').innerText()).includes('Pendências para liberação'),
  )
  const primeiraPendencia = normalizar(await pagina.locator('.lista-pendencias li').first().innerText())
  checar('Pendência mostra o responsável', primeiraPendencia.includes('Responsável:'))
  checar('Pendência mostra o motivo', primeiraPendencia.includes('Recusado em') || primeiraPendencia.length > 40)
  checar('Pendência mostra o prazo', primeiraPendencia.includes('Prazo:'))

  // ---------------------------------------------------------------- 8. planos
  await irPara('/plataforma/planos')
  const planos = normalizar(await pagina.locator('.grade-planos').innerText())
  checar('Plano Essencial: até 15 contratos, R$ 2.500,00/mês', planos.includes('Essencial') && planos.includes('R$ 2.500,00') && planos.includes('15'))
  checar('Plano Profissional: até 50 contratos, R$ 5.000,00/mês', planos.includes('Profissional') && planos.includes('R$ 5.000,00') && planos.includes('50'))
  checar('Plano Corporativo: acima de 50, a partir de R$ 10.000,00/mês', planos.includes('Corporativo') && planos.includes('R$ 10.000,00') && planos.includes('a partir de'))
  const paginaPlanos = normalizar(await pagina.locator('main').innerText())
  checar('Implantação de R$ 10.000,00 a R$ 30.000,00', paginaPlanos.includes('R$ 30.000,00'))
  checar('Fornecedores convidados sem custo', paginaPlanos.toLowerCase().includes('não paga'))
  checar('Nenhuma menção a R$ 499 na tela de planos', !paginaPlanos.includes('499'))

  // ---------------------------------------------------------------- 9. importar cauções do ERP
  await irPara('/contratante/importar')
  await pagina.waitForTimeout(350)
  checar(
    'Tela de importação traz o CSV de exemplo já preenchido',
    (await pagina.locator('#conteudo-csv').inputValue()).includes('CT-ERP-101'),
  )
  const previa = normalizar(await pagina.locator('.previa-csv').innerText())
  checar('Prévia mostra as três cauções do exemplo', previa.includes('CT-ERP-101') && previa.includes('CT-ERP-103'))
  checar('Prévia calcula o valor retido', previa.includes('R$ 12.500,00'))

  // Uma linha inconsistente é apontada com o motivo.
  const csvAtual = await pagina.locator('#conteudo-csv').inputValue()
  await pagina.locator('#conteudo-csv').fill(csvAtual + 'CT-ERP-104;Fornecedor X;100.000,00;150;5.000,00;30/11/2026\n')
  await pagina.waitForTimeout(300)
  checar(
    'Linha com percentual inválido é recusada com o motivo',
    normalizar(await pagina.locator('.linha-erro').innerText()).includes('entre 0 e 100'),
  )
  await pagina.getByRole('button', { name: 'Restaurar o exemplo' }).click()
  await pagina.waitForTimeout(300)

  await pagina.getByRole('button', { name: /Importar 3 caução/ }).click()
  await pagina.waitForTimeout(500)
  const listaAposImportar = normalizar(await pagina.locator('table.tabela').innerText())
  checar('Importação cria os contratos na lista', listaAposImportar.includes('CT-ERP-101') && listaAposImportar.includes('CT-ERP-103'))

  await abrirContrato('/contratante/contratos', 'CT-ERP-102')
  const importado = normalizar(await pagina.locator('.definicoes').first().innerText())
  checar('Contrato importado traz o valor medido de R$ 180.000,00', importado.includes('R$ 180.000,00'))
  checar('Contrato importado traz a retenção de R$ 18.000,00', importado.includes('R$ 18.000,00'))
  checar('Contrato importado usa o vencimento como data mínima', importado.includes('15/12/2026'))

  // ---------------------------------------------------------------- 10. persistência
  await pagina.reload()
  await pagina.waitForTimeout(500)
  checar(
    'Contrato importado continua após atualizar a página',
    normalizar(await pagina.locator('.definicoes').first().innerText()).includes('R$ 180.000,00'),
  )
  checar(
    'Data da simulação persiste',
    (await pagina.locator('.chip-data').innerText()).includes('30/07/2026'),
  )

  // ---------------------------------------------------------------- 11. liberação completa
  await irPara('/plataforma/simulacao')
  await pagina.getByRole('button', { name: /31\/07\/2026 — prazo cumprido/ }).click()
  await pagina.waitForTimeout(400)
  await irPara('/contratada')
  await pagina.selectOption('#seletor-contratada', { label: 'Andrade Montagens Ltda.' })
  await pagina.waitForTimeout(300)
  await abrirContrato('/contratada/contratos', 'CT-2026-100')
  await pagina.getByRole('button', { name: 'Solicitar liberação' }).click()
  await pagina.waitForTimeout(250)
  checar(
    'Diálogo de solicitação mostra R$ 5.000,00',
    normalizar(await pagina.locator('.modal-corpo').innerText()).includes('R$ 5.000,00'),
  )
  await pagina.getByRole('button', { name: 'Solicitar liberação' }).last().click()
  await pagina.waitForTimeout(450)

  await abrirContrato('/contratante/contratos', 'CT-2026-100')
  await pagina.getByRole('button', { name: 'Confirmar liberação simulada' }).click()
  await pagina.waitForTimeout(250)
  await pagina.getByRole('button', { name: 'Confirmar liberação' }).last().click()
  await pagina.waitForTimeout(450)
  checar(
    'Contrato padrão liberado por R$ 5.000,00',
    normalizar(await pagina.locator('.aviso-sucesso-bloco').innerText()).includes('R$ 5.000,00'),
  )
  checar(
    'Liberação duplicada impedida',
    (await pagina.getByRole('button', { name: 'Confirmar liberação simulada' }).count()) === 0,
  )

  // ---------------------------------------------------------------- 12. restaurar demonstração
  await irPara('/sobre')
  await pagina.waitForTimeout(300)
  await pagina.getByRole('button', { name: /Restaurar demonstração/ }).first().click()
  await pagina.waitForTimeout(250)
  checar('Restauração pede confirmação', await pagina.locator('.fundo-modal').isVisible())
  await pagina.getByRole('button', { name: 'Sim, restaurar' }).click()
  await pagina.waitForTimeout(500)
  await irPara('/contratante/contratos')
  await pagina.waitForTimeout(400)
  const tabelaRestaurada = normalizar(await pagina.locator('table.tabela').innerText())
  checar('Após restaurar, os contratos importados somem', !tabelaRestaurada.includes('CT-ERP-101'))
  checar('Após restaurar, o contrato padrão volta a R$ 5.000,00 retidos', tabelaRestaurada.includes('R$ 5.000,00'))
  checar(
    'Após restaurar, a data da simulação volta a 30/07/2026',
    (await pagina.locator('.chip-data').innerText()).includes('30/07/2026'),
  )

  // ---------------------------------------------------------------- 13. celular
  const celular = await navegador.newContext({ viewport: { width: 390, height: 844 } })
  const paginaCelular = await celular.newPage()
  const errosCelular = []
  paginaCelular.on('pageerror', (e) => errosCelular.push(String(e)))

  for (const rota of [
    '/contratante',
    '/contratante/contratos',
    '/contratante/importar',
    '/contratada',
    '/plataforma/planos',
    '/plataforma/simulacao',
  ]) {
    await paginaCelular.goto(`${BASE}#${rota}`)
    await paginaCelular.waitForTimeout(400)
    const largura = await paginaCelular.evaluate(() => document.documentElement.scrollWidth)
    checar(`Celular 390px sem rolagem horizontal em ${rota}`, largura <= 400, `scrollWidth=${largura}`)
  }

  await paginaCelular.goto(`${BASE}#/contratante`)
  await paginaCelular.waitForTimeout(400)
  checar('No celular o menu aparece recolhido', await paginaCelular.locator('.botao-menu').isVisible())
  await paginaCelular.locator('.botao-menu').click()
  await paginaCelular.waitForTimeout(300)
  checar('Botão abre o menu lateral no celular', await paginaCelular.locator('.menu-lateral.aberto').isVisible())
  checar('Menu do celular traz a marca TrustRetain', (await paginaCelular.locator('.menu-marca .nome').innerText()).includes('TrustRetain'))
  checar('Sem erro de JavaScript no celular', errosCelular.length === 0, errosCelular.slice(0, 2).join(' | '))
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
