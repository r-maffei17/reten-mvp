// Detalhe do contrato: resumo, medições, documentos, extrato financeiro e histórico.
// A mesma tela serve aos três perfis; as ações disponíveis mudam conforme o perfil.

import { useMemo, useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
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
  simularProximoMes,
  solicitarLiberacao,
} from '../domain/acoes'
import { calcularRetencao } from '../domain/calculos'
import {
  formatarData,
  formatarDataHora,
  formatarPeriodo,
  formatarPeriodoCurto,
  hojeISO,
  proximoPeriodo,
  periodoAtual,
} from '../domain/datas'
import { formatarMoeda, formatarPercentual, textoParaCents } from '../domain/money'
import { detalharContrato } from '../domain/selecoes'
import type { EventoHistorico } from '../domain/types'
import {
  temErros,
  validarDisputa,
  validarMedicao,
  validarRejeicaoDocumento,
  type ErrosFormulario,
} from '../domain/validacoes'
import { Campo, Confirmacao, Etiqueta, Modal, Painel, Vazio } from '../components/Interface'
import { EtiquetaDeposito, EtiquetaDocumento, EtiquetaLiberacao } from '../components/Status'

type Aba = 'resumo' | 'medicoes' | 'documentos' | 'extrato' | 'historico'

const ABAS: Array<{ chave: Aba; rotulo: string }> = [
  { chave: 'resumo', rotulo: 'Resumo' },
  { chave: 'medicoes', rotulo: 'Medições e retenções' },
  { chave: 'documentos', rotulo: 'Documentos e obrigações' },
  { chave: 'extrato', rotulo: 'Extrato financeiro' },
  { chave: 'historico', rotulo: 'Histórico' },
]

const COR_EVENTO: Record<string, string> = {
  documento_rejeitado: 'vermelho',
  disputa_aberta: 'vermelho',
  liberacao_confirmada: 'verde',
  documento_aprovado: 'verde',
  deposito_confirmado: 'verde',
  entrega_aceita: 'verde',
  rendimento_simulado: 'ambar',
}

export function DetalheContrato({ contratoId, voltarPara }: { contratoId: string; voltarPara: string }) {
  const { estado, perfil, executar } = useDemo()
  const [aba, setAba] = useState<Aba>('resumo')

  const contrato = estado.contratos.find((c) => c.id === contratoId)

  // Formulários e diálogos
  const [formMedicao, setFormMedicao] = useState({ descricao: '', data: hojeISO(), valor: '' })
  const [errosMedicao, setErrosMedicao] = useState<ErrosFormulario>({})
  const [medicaoAberta, setMedicaoAberta] = useState(false)

  const [documentoRejeitando, setDocumentoRejeitando] = useState<string | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [errosRejeicao, setErrosRejeicao] = useState<ErrosFormulario>({})

  const [disputaAbrindo, setDisputaAbrindo] = useState(false)
  const [textoDisputa, setTextoDisputa] = useState('')
  const [errosDisputa, setErrosDisputa] = useState<ErrosFormulario>({})

  const [disputaResolvendo, setDisputaResolvendo] = useState<string | null>(null)
  const [textoResolucao, setTextoResolucao] = useState('')
  const [errosResolucao, setErrosResolucao] = useState<ErrosFormulario>({})

  const [confirmandoLiberacao, setConfirmandoLiberacao] = useState(false)
  const [confirmandoSolicitacao, setConfirmandoSolicitacao] = useState(false)

  const detalhe = useMemo(
    () => (contrato ? detalharContrato(estado, contrato) : null),
    [estado, contrato],
  )

  const lancamentos = useMemo(
    () =>
      estado.rendimentos
        .filter((r) => r.contratoId === contratoId)
        .sort((a, b) => (a.periodo < b.periodo ? -1 : 1)),
    [estado.rendimentos, contratoId],
  )

  const historico = useMemo(
    () => estado.historico.filter((h) => h.contratoId === contratoId),
    [estado.historico, contratoId],
  )

  if (!contrato || !detalhe) {
    return (
      <Painel titulo="Contrato não encontrado">
        <Vazio
          simbolo="🔎"
          titulo="Este contrato não existe nesta demonstração"
          descricao="Ele pode ter sido removido ao restaurar os dados iniciais neste navegador."
          acao={
            <button className="botao primario" onClick={() => navegar(voltarPara)}>
              Voltar para a lista
            </button>
          }
        />
      </Painel>
    )
  }

  const { resumo, avaliacao, disputaEmAberto, medicoes, documentos } = detalhe
  const ehContratante = perfil === 'contratante'
  const ehContratada = perfil === 'contratada'
  const ehPlataforma = perfil === 'plataforma'
  const liberado = Boolean(contrato.liberadoEm)

  const valorMedicaoCents = textoParaCents(formMedicao.valor)
  const retencaoPrevista =
    valorMedicaoCents !== null && valorMedicaoCents > 0
      ? calcularRetencao(valorMedicaoCents, contrato.percentualRetencao)
      : 0
  const restantePrevisto = valorMedicaoCents !== null ? valorMedicaoCents - retencaoPrevista : 0

  const proximoPeriodoSimulacao = resumo.ultimoPeriodoRendimento
    ? proximoPeriodo(resumo.ultimoPeriodoRendimento)
    : periodoAtual()

  // ------------------------------------------------------------- handlers

  const salvarMedicao = () => {
    const dados = {
      descricao: formMedicao.descricao,
      data: formMedicao.data,
      valorCents: valorMedicaoCents,
    }
    const erros = validarMedicao(dados, contrato, estado.medicoes, estado.documentos, estado.rendimentos)
    setErrosMedicao(erros)
    if (temErros(erros)) return
    const ok = executar((e) =>
      registrarMedicao(e, contrato.id, {
        descricao: dados.descricao,
        data: dados.data,
        valorCents: dados.valorCents as number,
      }),
    )
    if (ok) {
      setFormMedicao({ descricao: '', data: hojeISO(), valor: '' })
      setErrosMedicao({})
      setMedicaoAberta(false)
      setAba('medicoes')
    }
  }

  const salvarRejeicao = () => {
    const erros = validarRejeicaoDocumento(motivoRejeicao)
    setErrosRejeicao(erros)
    if (temErros(erros) || !documentoRejeitando) return
    const ok = executar((e) => rejeitarDocumento(e, documentoRejeitando, motivoRejeicao))
    if (ok) {
      setDocumentoRejeitando(null)
      setMotivoRejeicao('')
      setErrosRejeicao({})
    }
  }

  const salvarDisputa = () => {
    const erros = validarDisputa(textoDisputa)
    setErrosDisputa(erros)
    if (temErros(erros)) return
    const ok = executar((e) => abrirDisputa(e, contrato.id, textoDisputa))
    if (ok) {
      setDisputaAbrindo(false)
      setTextoDisputa('')
      setErrosDisputa({})
    }
  }

  const salvarResolucao = () => {
    const erros = validarDisputa(textoResolucao)
    setErrosResolucao(erros)
    if (temErros(erros) || !disputaResolvendo) return
    const ok = executar((e) => resolverDisputa(e, disputaResolvendo, textoResolucao))
    if (ok) {
      setDisputaResolvendo(null)
      setTextoResolucao('')
      setErrosResolucao({})
    }
  }

  // ------------------------------------------------------------- blocos

  const blocoStatus = (
    <div className="linha-acoes" style={{ alignItems: 'center' }}>
      <EtiquetaLiberacao status={avaliacao.status} />
      {disputaEmAberto ? <Etiqueta tom="perigo">Disputa em aberto</Etiqueta> : null}
      {contrato.entregaAceita ? (
        <Etiqueta tom="sucesso">Entrega aceita</Etiqueta>
      ) : (
        <Etiqueta tom="neutra">Entrega não aceita</Etiqueta>
      )}
    </div>
  )

  const checklist = (
    <ul className="checklist">
      {avaliacao.condicoes.map((c) => (
        <li key={c.chave} className={c.cumprida ? 'cumprida' : 'pendente'}>
          <span className="marca" aria-hidden="true">
            {c.cumprida ? '✓' : '!'}
          </span>
          <span>
            <span className="titulo">
              {c.titulo} — {c.cumprida ? 'cumprida' : 'pendente'}
            </span>
            <span className="detalhe" style={{ display: 'block' }}>
              {c.detalhe}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <button className="migalha" onClick={() => navegar(voltarPara)}>
        ← Voltar para a lista de contratos
      </button>

      <div className="cabecalho-pagina">
        <div>
          <h1>{contrato.nome}</h1>
          <p className="descricao">
            {contrato.codigo} · {detalhe.contratante?.nome} → {detalhe.contratada?.nome}
          </p>
          <div style={{ marginTop: 8 }}>{blocoStatus}</div>
        </div>
      </div>

      {liberado ? (
        <div className="aviso-sucesso-bloco">
          <strong>Contrato liberado em {formatarData(contrato.liberadoEm)}.</strong> Foram liberados{' '}
          {formatarMoeda(contrato.liberacao?.totalCents ?? 0)} (principal de{' '}
          {formatarMoeda(contrato.liberacao?.principalCents ?? 0)} e rendimentos de{' '}
          {formatarMoeda(contrato.liberacao?.rendimentoContratadaCents ?? 0)}). O contrato não aceita
          novas movimentações e o extrato foi preservado.
        </div>
      ) : null}

      {disputaEmAberto ? (
        <div className="aviso-disputa">
          <strong>Disputa em aberto desde {formatarData(disputaEmAberto.abertaEm)}.</strong>{' '}
          {disputaEmAberto.descricao}
          {ehContratante ? (
            <div style={{ marginTop: 8 }}>
              <button
                className="botao secundario pequeno"
                onClick={() => setDisputaResolvendo(disputaEmAberto.id)}
              >
                Resolver disputa
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="painel">
        <div className="abas" role="tablist" aria-label="Seções do contrato">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              role="tab"
              aria-selected={aba === a.chave}
              onClick={() => setAba(a.chave)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        <div className="painel-corpo">
          {/* ------------------------------------------------ RESUMO */}
          {aba === 'resumo' ? (
            <div className="pilha">
              <dl className="definicoes">
                <div>
                  <dt>Valor total do contrato</dt>
                  <dd className="numero">{formatarMoeda(contrato.valorTotalCents)}</dd>
                </div>
                <div>
                  <dt>Percentual de retenção</dt>
                  <dd className="numero">{formatarPercentual(contrato.percentualRetencao)}</dd>
                </div>
                <div>
                  <dt>Total medido</dt>
                  <dd className="numero">{formatarMoeda(resumo.totalMedidoCents)}</dd>
                </div>
                <div>
                  <dt>Disponível para medir</dt>
                  <dd className="numero">{formatarMoeda(resumo.saldoAMedirCents)}</dd>
                </div>
                <div>
                  <dt>Vigência</dt>
                  <dd>
                    {formatarData(contrato.dataInicio)} a {formatarData(contrato.dataTermino)}
                  </dd>
                </div>
                <div>
                  <dt>Data mínima para liberação</dt>
                  <dd>{formatarData(contrato.dataMinimaLiberacao)}</dd>
                </div>
                <div>
                  <dt>Principal retido</dt>
                  <dd className="numero">{formatarMoeda(resumo.principalRetidoCents)}</dd>
                </div>
                <div>
                  <dt>Rendimentos da contratada</dt>
                  <dd className="numero">{formatarMoeda(resumo.rendimentoRetidoCents)}</dd>
                </div>
                <div>
                  <dt>Saldo para liberação</dt>
                  <dd className="numero">{formatarMoeda(resumo.saldoParaLiberacaoCents)}</dd>
                </div>
                <div>
                  <dt>Total já liberado</dt>
                  <dd className="numero">{formatarMoeda(resumo.totalLiberadoCents)}</dd>
                </div>
              </dl>

              <div>
                <h3 style={{ marginBottom: 6 }}>Condições de liberação previstas no contrato</h3>
                <p className="texto-pequeno">{contrato.condicoesLiberacao}</p>
              </div>

              <div>
                <h3 style={{ marginBottom: 8 }}>Checklist de condições</h3>
                {checklist}
              </div>

              <div className="linha-acoes">
                {ehContratante && !liberado && !contrato.entregaAceita ? (
                  <button
                    className="botao verde"
                    onClick={() => executar((e) => aceitarEntrega(e, contrato.id))}
                  >
                    Registrar aceite da entrega
                  </button>
                ) : null}
                {ehContratante && !liberado && !disputaEmAberto ? (
                  <button className="botao perigo" onClick={() => setDisputaAbrindo(true)}>
                    Registrar disputa
                  </button>
                ) : null}
                {ehContratada && !liberado && avaliacao.status === 'elegivel' ? (
                  <button className="botao verde" onClick={() => setConfirmandoSolicitacao(true)}>
                    Solicitar liberação
                  </button>
                ) : null}
                {ehContratante && avaliacao.status === 'solicitada' ? (
                  <button className="botao verde" onClick={() => setConfirmandoLiberacao(true)}>
                    Confirmar liberação simulada
                  </button>
                ) : null}
              </div>

              {ehContratada && avaliacao.status === 'bloqueada' ? (
                <div className="aviso-bloqueio">
                  <strong>Liberação bloqueada. Falta cumprir:</strong>
                  <ul>
                    {avaliacao.pendencias.map((p) => (
                      <li key={p.chave}>
                        {p.titulo}: {p.detalhe}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {avaliacao.status === 'solicitada' ? (
                <div className="nota">
                  Liberação solicitada em {formatarData(contrato.liberacaoSolicitadaEm)}. As condições
                  serão revalidadas no momento da confirmação pela contratante.
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ------------------------------------------------ MEDIÇÕES */}
          {aba === 'medicoes' ? (
            <div className="pilha">
              <div className="linha-acoes">
                {ehContratante && !liberado ? (
                  <button className="botao primario" onClick={() => setMedicaoAberta(true)}>
                    + Registrar medição
                  </button>
                ) : null}
                <span className="texto-pequeno texto-mudo" style={{ alignSelf: 'center' }}>
                  Retenção calculada automaticamente a {formatarPercentual(contrato.percentualRetencao)}{' '}
                  do valor de cada medição.
                </span>
              </div>

              {medicoes.length === 0 ? (
                <Vazio
                  simbolo="📐"
                  titulo="Nenhuma medição registrada"
                  descricao="Registre a primeira medição para que a retenção seja calculada e o depósito simulado possa ser confirmado."
                />
              ) : (
                <div className="tabela-rolagem">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Medição</th>
                        <th>Data</th>
                        <th className="num">Valor da medição</th>
                        <th className="num">Valor retido</th>
                        <th className="num">Valor restante</th>
                        <th>Depósito simulado</th>
                        {ehContratante && !liberado ? <th /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {medicoes.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div className="titulo-linha">{m.descricao}</div>
                          </td>
                          <td>{formatarData(m.data)}</td>
                          <td className="num">{formatarMoeda(m.valorCents)}</td>
                          <td className="num">{formatarMoeda(m.retencaoCents)}</td>
                          <td className="num">{formatarMoeda(m.valorCents - m.retencaoCents)}</td>
                          <td>
                            <EtiquetaDeposito confirmado={m.depositoConfirmado} />
                            {m.depositoConfirmadoEm ? (
                              <div className="sub-linha">{formatarData(m.depositoConfirmadoEm)}</div>
                            ) : null}
                          </td>
                          {ehContratante && !liberado ? (
                            <td>
                              <div className="acoes-celula">
                                {!m.depositoConfirmado ? (
                                  <button
                                    className="botao verde pequeno"
                                    onClick={() => executar((e) => confirmarDeposito(e, m.id))}
                                  >
                                    Confirmar depósito
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                      <tr className="linha-forte">
                        <td colSpan={2}>Totais</td>
                        <td className="num">{formatarMoeda(resumo.totalMedidoCents)}</td>
                        <td className="num">{formatarMoeda(resumo.retencaoTotalCents)}</td>
                        <td className="num">
                          {formatarMoeda(resumo.totalMedidoCents - resumo.retencaoTotalCents)}
                        </td>
                        <td colSpan={ehContratante && !liberado ? 2 : 1}>
                          {formatarMoeda(resumo.principalDepositadoCents)} depositados
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {resumo.principalAguardandoDepositoCents > 0 ? (
                <div className="nota">
                  {formatarMoeda(resumo.principalAguardandoDepositoCents)} em retenções ainda não têm
                  depósito simulado confirmado. Somente valores com depósito confirmado entram na base
                  de rendimento e permitem a liberação.
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ------------------------------------------------ DOCUMENTOS */}
          {aba === 'documentos' ? (
            <div className="pilha">
              {documentos.length === 0 ? (
                <Vazio
                  simbolo="📁"
                  titulo="Nenhum documento cadastrado"
                  descricao="Nesta versão de demonstração, os documentos obrigatórios acompanham os contratos de exemplo."
                />
              ) : (
                <div className="tabela-rolagem">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Obrigatório</th>
                        <th>Situação</th>
                        <th>Arquivo (fictício)</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {documentos.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <div className="titulo-linha">{d.nome}</div>
                            {d.motivoRejeicao ? (
                              <div className="aviso-rejeicao">
                                <strong>Justificativa da rejeição:</strong> {d.motivoRejeicao}
                              </div>
                            ) : null}
                          </td>
                          <td>{d.obrigatorio ? 'Sim' : 'Não'}</td>
                          <td>
                            <EtiquetaDocumento status={d.status} />
                            {d.enviadoEm ? (
                              <div className="sub-linha">Envio: {formatarData(d.enviadoEm)}</div>
                            ) : null}
                            {d.analisadoEm ? (
                              <div className="sub-linha">Análise: {formatarData(d.analisadoEm)}</div>
                            ) : null}
                          </td>
                          <td className="texto-pequeno">{d.arquivoNome ?? '—'}</td>
                          <td>
                            <div className="acoes-celula">
                              {ehContratada && !liberado && (d.status === 'pendente' || d.status === 'rejeitado') ? (
                                <button
                                  className="botao primario pequeno"
                                  onClick={() => executar((e) => enviarDocumento(e, d.id))}
                                >
                                  {d.status === 'rejeitado' ? 'Reenviar documento' : 'Simular envio'}
                                </button>
                              ) : null}
                              {ehContratante && !liberado && d.status === 'enviado' ? (
                                <>
                                  <button
                                    className="botao verde pequeno"
                                    onClick={() => executar((e) => aprovarDocumento(e, d.id))}
                                  >
                                    Aprovar
                                  </button>
                                  <button
                                    className="botao perigo pequeno"
                                    onClick={() => {
                                      setDocumentoRejeitando(d.id)
                                      setMotivoRejeicao('')
                                      setErrosRejeicao({})
                                    }}
                                  >
                                    Rejeitar
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="nota">
                Nesta demonstração não há upload de arquivos reais. A ação “Simular envio” gera um nome
                de arquivo fictício e muda a situação do documento.
              </div>
            </div>
          ) : null}

          {/* ------------------------------------------------ EXTRATO */}
          {aba === 'extrato' ? (
            <div className="pilha">
              <dl className="definicoes">
                <div>
                  <dt>Principal depositado (base do rendimento)</dt>
                  <dd className="numero">{formatarMoeda(resumo.principalElegivelRendimentoCents)}</dd>
                </div>
                <div>
                  <dt>Rendimento bruto acumulado</dt>
                  <dd className="numero">{formatarMoeda(resumo.rendimentoBrutoAcumuladoCents)}</dd>
                </div>
                <div>
                  <dt>Rendimento da contratada (acumulado)</dt>
                  <dd className="numero">{formatarMoeda(resumo.rendimentoContratadaAcumuladoCents)}</dd>
                </div>
                <div>
                  <dt>Receita da plataforma (acumulada)</dt>
                  <dd className="numero">{formatarMoeda(resumo.receitaPlataformaAcumuladaCents)}</dd>
                </div>
                <div>
                  <dt>Saldo para liberação</dt>
                  <dd className="numero">{formatarMoeda(resumo.saldoParaLiberacaoCents)}</dd>
                </div>
              </dl>

              {(ehContratante || ehPlataforma) && !liberado ? (
                <div className="linha-acoes">
                  <button
                    className="botao primario"
                    onClick={() => executar((e) => simularProximoMes(e, contrato.id))}
                  >
                    Simular próximo mês ({formatarPeriodoCurto(proximoPeriodoSimulacao)})
                  </button>
                  <span className="texto-pequeno texto-mudo" style={{ alignSelf: 'center' }}>
                    Aplica {formatarPercentual(estado.configuracoes.taxaMensalPercentual)} sobre{' '}
                    {formatarMoeda(resumo.principalElegivelRendimentoCents)}.
                  </span>
                </div>
              ) : null}

              {lancamentos.length === 0 ? (
                <Vazio
                  simbolo="📈"
                  titulo="Nenhum rendimento lançado"
                  descricao="Use “Simular próximo mês” para lançar o rendimento hipotético sobre o principal já depositado."
                />
              ) : (
                <div className="tabela-rolagem">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th className="num">Principal base</th>
                        <th className="num">Taxa aplicada</th>
                        <th className="num">Rendimento bruto</th>
                        <th className="num">Receita da plataforma</th>
                        <th className="num">Rendimento da contratada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((r) => (
                        <tr key={r.id}>
                          <td>{formatarPeriodo(r.periodo)}</td>
                          <td className="num">{formatarMoeda(r.principalBaseCents)}</td>
                          <td className="num">
                            {formatarPercentual(r.taxaMensalPercentual)}
                            <div className="sub-linha">
                              plataforma {formatarPercentual(r.participacaoPercentual)}
                            </div>
                          </td>
                          <td className="num">{formatarMoeda(r.rendimentoBrutoCents)}</td>
                          <td className="num">{formatarMoeda(r.receitaPlataformaCents)}</td>
                          <td className="num">{formatarMoeda(r.rendimentoContratadaCents)}</td>
                        </tr>
                      ))}
                      <tr className="linha-forte">
                        <td colSpan={3}>Totais</td>
                        <td className="num">{formatarMoeda(resumo.rendimentoBrutoAcumuladoCents)}</td>
                        <td className="num">{formatarMoeda(resumo.receitaPlataformaAcumuladaCents)}</td>
                        <td className="num">
                          {formatarMoeda(resumo.rendimentoContratadaAcumuladoCents)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="nota">
                Simulação sem capitalização: a taxa incide apenas sobre o principal depositado e ainda
                não liberado. Os valores desconsideram tributos e outros custos. A mensalidade da
                plataforma é cobrada à parte e não reduz o saldo da contratada. Alterações de taxa
                valem somente para lançamentos futuros.
              </div>
            </div>
          ) : null}

          {/* ------------------------------------------------ HISTÓRICO */}
          {aba === 'historico' ? (
            historico.length === 0 ? (
              <Vazio
                simbolo="🕘"
                titulo="Sem registros no histórico"
                descricao="As aprovações, depósitos, rendimentos e liberações deste contrato aparecerão aqui."
              />
            ) : (
              <ul className="linha-tempo">
                {historico.map((h: EventoHistorico) => (
                  <li key={h.id}>
                    <span className={`ponto ${COR_EVENTO[h.tipo] ?? ''}`} aria-hidden="true" />
                    <div>
                      <div className="texto">{h.descricao}</div>
                      <div className="meta">
                        {formatarDataHora(h.data)} · registrado pelo perfil {h.perfil}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------ diálogos */}

      {medicaoAberta ? (
        <Modal
          titulo="Registrar medição"
          aoFechar={() => setMedicaoAberta(false)}
          rodape={
            <>
              <button className="botao secundario" onClick={() => setMedicaoAberta(false)}>
                Cancelar
              </button>
              <button className="botao primario" onClick={salvarMedicao}>
                Registrar medição
              </button>
            </>
          }
        >
          <div className="formulario">
            <Campo id="med-descricao" rotulo="Descrição da medição" erro={errosMedicao.descricao}>
              <input
                id="med-descricao"
                value={formMedicao.descricao}
                onChange={(e) => setFormMedicao({ ...formMedicao, descricao: e.target.value })}
                placeholder="Ex.: Medição 04 — montagem de equipamentos"
              />
            </Campo>
            <div className="grade-campos">
              <Campo id="med-data" rotulo="Data da medição" erro={errosMedicao.data}>
                <input
                  id="med-data"
                  type="date"
                  value={formMedicao.data}
                  onChange={(e) => setFormMedicao({ ...formMedicao, data: e.target.value })}
                />
              </Campo>
              <Campo
                id="med-valor"
                rotulo="Valor da medição (R$)"
                erro={errosMedicao.valor}
                dica={`Disponível para medir: ${formatarMoeda(resumo.saldoAMedirCents)}`}
              >
                <input
                  id="med-valor"
                  inputMode="decimal"
                  value={formMedicao.valor}
                  onChange={(e) => setFormMedicao({ ...formMedicao, valor: e.target.value })}
                  placeholder="Ex.: 100.000,00"
                />
              </Campo>
            </div>

            <div className="nota">
              <strong>Cálculo automático a {formatarPercentual(contrato.percentualRetencao)}:</strong>
              <dl className="definicoes" style={{ marginTop: 8 }}>
                <div>
                  <dt>Valor da medição</dt>
                  <dd className="numero">{formatarMoeda(valorMedicaoCents ?? 0)}</dd>
                </div>
                <div>
                  <dt>Valor retido</dt>
                  <dd className="numero">{formatarMoeda(retencaoPrevista)}</dd>
                </div>
                <div>
                  <dt>Valor restante a pagar</dt>
                  <dd className="numero">{formatarMoeda(restantePrevisto)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Modal>
      ) : null}

      {documentoRejeitando ? (
        <Modal
          titulo="Rejeitar documento"
          aoFechar={() => setDocumentoRejeitando(null)}
          rodape={
            <>
              <button className="botao secundario" onClick={() => setDocumentoRejeitando(null)}>
                Cancelar
              </button>
              <button className="botao perigo" onClick={salvarRejeicao}>
                Rejeitar documento
              </button>
            </>
          }
        >
          <Campo
            id="motivo-rejeicao"
            rotulo="Justificativa da rejeição (obrigatória)"
            erro={errosRejeicao.motivo}
            dica="A contratada verá esta justificativa e poderá reenviar o documento."
          >
            <textarea
              id="motivo-rejeicao"
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Ex.: documento sem assinatura do responsável técnico."
            />
          </Campo>
        </Modal>
      ) : null}

      {disputaAbrindo ? (
        <Modal
          titulo="Registrar disputa"
          aoFechar={() => setDisputaAbrindo(false)}
          rodape={
            <>
              <button className="botao secundario" onClick={() => setDisputaAbrindo(false)}>
                Cancelar
              </button>
              <button className="botao perigo" onClick={salvarDisputa}>
                Registrar disputa
              </button>
            </>
          }
        >
          <Campo
            id="texto-disputa"
            rotulo="Descrição da disputa"
            erro={errosDisputa.descricao}
            dica="Enquanto houver disputa em aberto, a liberação fica bloqueada."
          >
            <textarea
              id="texto-disputa"
              value={textoDisputa}
              onChange={(e) => setTextoDisputa(e.target.value)}
              placeholder="Ex.: divergência de quantitativo na medição 03."
            />
          </Campo>
        </Modal>
      ) : null}

      {disputaResolvendo ? (
        <Modal
          titulo="Resolver disputa"
          aoFechar={() => setDisputaResolvendo(null)}
          rodape={
            <>
              <button className="botao secundario" onClick={() => setDisputaResolvendo(null)}>
                Cancelar
              </button>
              <button className="botao verde" onClick={salvarResolucao}>
                Registrar resolução
              </button>
            </>
          }
        >
          <Campo
            id="texto-resolucao"
            rotulo="Como a disputa foi resolvida"
            erro={errosResolucao.descricao}
          >
            <textarea
              id="texto-resolucao"
              value={textoResolucao}
              onChange={(e) => setTextoResolucao(e.target.value)}
              placeholder="Ex.: quantitativo revisado em conjunto e aceito pelas partes."
            />
          </Campo>
        </Modal>
      ) : null}

      {confirmandoSolicitacao ? (
        <Confirmacao
          titulo="Solicitar liberação?"
          textoConfirmar="Solicitar liberação"
          tomConfirmar="verde"
          mensagem={
            <>
              <p>
                Será enviada à contratante uma solicitação de liberação integral de{' '}
                <strong>{formatarMoeda(avaliacao.saldoParaLiberacaoCents)}</strong>.
              </p>
              <p className="texto-pequeno texto-mudo" style={{ marginBottom: 0 }}>
                As condições serão revalidadas quando a contratante confirmar.
              </p>
            </>
          }
          aoConfirmar={() => {
            executar((e) => solicitarLiberacao(e, contrato.id))
            setConfirmandoSolicitacao(false)
          }}
          aoCancelar={() => setConfirmandoSolicitacao(false)}
        />
      ) : null}

      {confirmandoLiberacao ? (
        <Confirmacao
          titulo="Confirmar liberação simulada?"
          textoConfirmar="Confirmar liberação"
          tomConfirmar="verde"
          mensagem={
            <>
              <p>
                Serão liberados <strong>{formatarMoeda(avaliacao.saldoParaLiberacaoCents)}</strong>:
                principal de {formatarMoeda(resumo.principalRetidoCents)} mais rendimentos de{' '}
                {formatarMoeda(resumo.rendimentoRetidoCents)}.
              </p>
              <p>
                Depois da confirmação o saldo retido é zerado, o extrato é preservado e o contrato não
                aceita novas movimentações.
              </p>
              <p className="texto-pequeno texto-mudo" style={{ marginBottom: 0 }}>
                Operação simulada: nenhum valor real é movimentado.
              </p>
            </>
          }
          aoConfirmar={() => {
            executar((e) => confirmarLiberacao(e, contrato.id))
            setConfirmandoLiberacao(false)
          }}
          aoCancelar={() => setConfirmandoLiberacao(false)}
        />
      ) : null}
    </>
  )
}
