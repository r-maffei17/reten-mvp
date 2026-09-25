// Visão da plataforma: carteira administrada, planos, data da simulação e
// parâmetros do módulo financeiro.

import { useMemo, useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import {
  abrirDisputa,
  definirDataSimulacao,
  definirPlano,
  resolverDisputa,
  salvarConfiguracoes,
} from '../domain/acoes'
import { disputaAberta } from '../domain/calculos'
import { CONTRATO_PADRAO } from '../domain/dadosIniciais'
import { formatarData, formatarPeriodo, somarDias } from '../domain/datas'
import { formatarMoeda, formatarPercentual, textoParaNumero } from '../domain/money'
import { IMPLANTACAO, PLANOS } from '../domain/planos'
import {
  calcularTotaisPlataforma,
  detalharTodos,
  listarAssinaturas,
} from '../domain/selecoes'
import type { IdPlano } from '../domain/types'
import { temErros, validarConfiguracoes, type ErrosFormulario } from '../domain/validacoes'
import { CartaoIndicador, Campo, Etiqueta, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao, EtiquetaModulo } from '../components/Status'

export function PainelPlataforma() {
  const { estado } = useDemo()
  const periodo = estado.dataSimulacao.slice(0, 7)
  const totais = useMemo(() => calcularTotaisPlataforma(estado, periodo), [estado, periodo])

  const porPeriodo = useMemo(() => {
    const mapa = new Map<string, { bruto: number; plataforma: number; contratada: number; lancamentos: number }>()
    for (const r of estado.rendimentos) {
      const atual = mapa.get(r.periodo) ?? { bruto: 0, plataforma: 0, contratada: 0, lancamentos: 0 }
      atual.bruto += r.rendimentoBrutoCents
      atual.plataforma += r.receitaPlataformaCents
      atual.contratada += r.rendimentoContratadaCents
      atual.lancamentos += 1
      mapa.set(r.periodo, atual)
    }
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [estado.rendimentos])

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Painel da plataforma</h1>
          <p className="descricao">
            Carteira administrada e receitas da simulação. As receitas mensais projetadas e as
            acumuladas são apresentadas separadamente, sem somar períodos diferentes.
          </p>
        </div>
        <div className="acoes">
          <button className="botao secundario" onClick={() => navegar('/plataforma/planos')}>
            Ver planos
          </button>
          <button className="botao secundario" onClick={() => navegar('/plataforma/simulacao')}>
            Data da simulação
          </button>
        </div>
      </div>

      <div className="grade-indicadores">
        <CartaoIndicador
          rotulo="Contratantes cadastradas"
          valor={totais.contratantes}
          apoio="Empresas que assinam um plano"
        />
        <CartaoIndicador
          rotulo="Contratos administrados"
          valor={totais.contratosAdministrados}
          apoio={`${totais.contratosComModuloFinanceiro} com módulo financeiro, ${totais.contratosLiberados} já liberados`}
        />
        <CartaoIndicador
          rotulo="Total de recursos retidos (simulado)"
          valor={formatarMoeda(totais.recursosRetidosCents)}
          apoio="Saldo retido de toda a carteira, posição atual"
        />
        <CartaoIndicador
          rotulo="Receita de assinaturas — projeção mensal"
          valor={`${totais.receitaAssinaturasEhPiso ? 'a partir de ' : ''}${formatarMoeda(totais.receitaAssinaturasMensalCents)}`}
          tom="verde"
          apoio="Soma das mensalidades dos planos contratados"
        />
        <CartaoIndicador
          rotulo="Participação nos rendimentos — acumulado"
          valor={formatarMoeda(totais.receitaParticipacaoAcumuladaCents)}
          tom="verde"
          apoio={`Todos os períodos já lançados (${formatarPercentual(estado.configuracoes.participacaoPercentual)} do rendimento bruto)`}
        />
        <CartaoIndicador
          rotulo="Participação nos rendimentos — mês corrente"
          valor={formatarMoeda(totais.receitaParticipacaoMesCorrenteCents)}
          apoio={`Somente lançamentos de ${formatarPeriodo(periodo)}`}
        />
      </div>

      <div className="nota">
        <strong>Indicadores separados de propósito.</strong> A projeção mensal de assinaturas é uma
        estimativa recorrente; a participação nos rendimentos é um valor acumulado de vários períodos
        simulados; a implantação é uma cobrança única. Os três não devem ser somados em um único
        número. A participação só existe em contratos com módulo financeiro ativo.
      </div>

      <Painel
        titulo="Rendimentos simulados por período"
        descricao="Cada linha reúne os lançamentos de todos os contratos com módulo financeiro naquele mês."
        semEspaco
      >
        {porPeriodo.length === 0 ? (
          <Vazio
            simbolo="📊"
            titulo="Nenhum rendimento lançado"
            descricao="Use “Simular próximo mês” dentro de um contrato com módulo financeiro para gerar lançamentos."
          />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Período</th>
                  <th className="num">Lançamentos</th>
                  <th className="num">Rendimento bruto</th>
                  <th className="num">Receita da plataforma</th>
                  <th className="num">Rendimento das contratadas</th>
                </tr>
              </thead>
              <tbody>
                {porPeriodo.map(([p, v]) => (
                  <tr key={p}>
                    <td>{formatarPeriodo(p)}</td>
                    <td className="num">{v.lancamentos}</td>
                    <td className="num">{formatarMoeda(v.bruto)}</td>
                    <td className="num">{formatarMoeda(v.plataforma)}</td>
                    <td className="num">{formatarMoeda(v.contratada)}</td>
                  </tr>
                ))}
                <tr className="linha-forte">
                  <td colSpan={2}>Acumulado</td>
                  <td className="num">{formatarMoeda(totais.rendimentoBrutoAcumuladoCents)}</td>
                  <td className="num">{formatarMoeda(totais.receitaParticipacaoAcumuladaCents)}</td>
                  <td className="num">
                    {formatarMoeda(
                      totais.rendimentoBrutoAcumuladoCents - totais.receitaParticipacaoAcumuladaCents,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </>
  )
}

// ------------------------------------------------------------------ Planos

export function PlanosPlataforma() {
  const { estado, executar } = useDemo()
  const assinaturas = useMemo(() => listarAssinaturas(estado), [estado])
  const totalMensal = assinaturas.reduce((s, a) => s + a.mensalidadeCents, 0)
  const algumAPartirDe = assinaturas.some((a) => a.aPartirDe)

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Planos</h1>
          <p className="descricao">
            A contratante paga pela gestão, por faixa de volume. Fornecedores convidados usam a
            plataforma sem custo. Valores de demonstração, não são uma tabela comercial definitiva.
          </p>
        </div>
      </div>

      <div className="grade-planos">
        {PLANOS.map((plano) => {
          const assinantes = assinaturas.filter((a) => a.contratante.planoId === plano.id)
          return (
            <div key={plano.id} className={`cartao-plano${assinantes.length > 0 ? ' atual' : ''}`}>
              <div>
                <h3>{plano.nome}</h3>
                <div className="faixa">{plano.faixa}</div>
              </div>
              {plano.aPartirDe ? <div className="antes-do-preco">a partir de</div> : null}
              <div className="preco">
                {formatarMoeda(plano.precoMensalCents)} <span className="unidade">/ mês</span>
              </div>
              <ul>
                {plano.destaques.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <div className="rodape-plano">
                {assinantes.length > 0 ? (
                  <Etiqueta tom="sucesso">
                    {assinantes.length === 1
                      ? `Contratado por ${assinantes[0].contratante.nome}`
                      : `${assinantes.length} contratantes neste plano`}
                  </Etiqueta>
                ) : (
                  <Etiqueta tom="neutra">Nenhuma contratante neste plano</Etiqueta>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="duas-colunas" style={{ marginTop: 18 }}>
        <Painel titulo="Implantação" descricao="Cobrança única, separada da mensalidade.">
          <div className="cartao-plano" style={{ border: 0, boxShadow: 'none', padding: 0 }}>
            <div className="antes-do-preco">de</div>
            <div className="preco">
              {formatarMoeda(IMPLANTACAO.minimoCents)}{' '}
              <span className="unidade">a {formatarMoeda(IMPLANTACAO.maximoCents)}</span>
            </div>
            <p className="texto-pequeno texto-mudo" style={{ marginBottom: 0 }}>
              Configuração dos contratos, carga inicial das cauções do ERP e treinamento das equipes.
              O valor depende do volume de contratos e da integração necessária. Não entra na projeção
              mensal.
            </p>
          </div>
        </Painel>

        <Painel titulo="Fornecedores convidados" descricao="Quem recebe o convite não paga nada.">
          <p>
            As contratadas acessam a plataforma por convite da contratante, sem mensalidade e sem
            implantação. Elas acompanham o saldo retido, as condições pendentes e o andamento dos
            documentos.
          </p>
          <div className="nota" style={{ marginBottom: 0 }}>
            {estado.contratadas.length} fornecedores convidados nesta demonstração, sem custo.
          </div>
        </Painel>
      </div>

      <Painel
        titulo="Assinaturas por contratante"
        descricao="A faixa considera os contratos com retenção ativa, ou seja, ainda não liberados."
        semEspaco
      >
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Contratante</th>
                <th className="num">Contratos com retenção ativa</th>
                <th>Plano contratado</th>
                <th className="num">Mensalidade</th>
                <th>Plano indicado pela faixa</th>
              </tr>
            </thead>
            <tbody>
              {assinaturas.map((a) => (
                <tr key={a.contratante.id}>
                  <td>
                    <div className="titulo-linha">{a.contratante.nome}</div>
                    <div className="sub-linha">{a.contratante.contato}</div>
                  </td>
                  <td className="num">{a.contratosComRetencaoAtiva}</td>
                  <td>
                    <select
                      aria-label={`Plano de ${a.contratante.nome}`}
                      value={a.contratante.planoId ?? 'essencial'}
                      onChange={(e) =>
                        executar((estadoAtual) =>
                          definirPlano(estadoAtual, a.contratante.id, e.target.value as IdPlano),
                        )
                      }
                    >
                      {PLANOS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                    {a.excedido ? (
                      <div style={{ marginTop: 6 }}>
                        <Etiqueta tom="alerta">Volume acima do teto do plano</Etiqueta>
                      </div>
                    ) : null}
                  </td>
                  <td className="num">
                    {a.aPartirDe ? 'a partir de ' : ''}
                    {formatarMoeda(a.mensalidadeCents)}
                  </td>
                  <td>{a.planoIndicado.nome}</td>
                </tr>
              ))}
              <tr className="linha-forte">
                <td colSpan={3}>Receita mensal projetada de assinaturas</td>
                <td className="num">
                  {algumAPartirDe ? 'a partir de ' : ''}
                  {formatarMoeda(totalMensal)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Painel>
    </>
  )
}

// ------------------------------------------------------------------ Data da simulação

export function SimulacaoPlataforma() {
  const { estado, executar } = useDemo()
  const [data, setData] = useState(estado.dataSimulacao)

  const contratoPadrao = estado.contratos.find((c) => c.codigo === CONTRATO_PADRAO.codigo)
  const detalhes = useMemo(() => detalharTodos(estado), [estado])
  const detalhePadrao = detalhes.find((d) => d.contrato.codigo === CONTRATO_PADRAO.codigo)
  const disputa = contratoPadrao ? disputaAberta(estado.disputas, contratoPadrao.id) : undefined

  const aplicar = (novaData: string) => {
    setData(novaData)
    executar((e) => definirDataSimulacao(e, novaData))
  }

  const vespera = contratoPadrao ? somarDias(contratoPadrao.dataMinimaLiberacao, -1) : ''
  const noPrazo = contratoPadrao?.dataMinimaLiberacao ?? ''

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Data da simulação</h1>
          <p className="descricao">
            Esta é a data de referência usada em toda a aplicação: as travas de prazo, os carimbos de
            envio e análise e os períodos de rendimento seguem ela, não o relógio do computador.
          </p>
        </div>
      </div>

      <div className="duas-colunas">
        <Painel titulo="Ajustar a data">
          <div className="formulario">
            <Campo
              id="data-simulacao"
              rotulo="Data de referência"
              dica={`Atualmente: ${formatarData(estado.dataSimulacao)}`}
            >
              <input
                id="data-simulacao"
                type="date"
                value={data}
                onChange={(e) => aplicar(e.target.value)}
              />
            </Campo>

            {contratoPadrao ? (
              <>
                <div className="nota">
                  Atalhos para o contrato de teste padrão ({contratoPadrao.codigo}), cujo prazo vence em{' '}
                  {formatarData(contratoPadrao.dataMinimaLiberacao)}:
                </div>
                <div className="linha-acoes">
                  <button className="botao secundario" onClick={() => aplicar(vespera)}>
                    {formatarData(vespera)} — véspera (bloqueado)
                  </button>
                  <button className="botao verde" onClick={() => aplicar(noPrazo)}>
                    {formatarData(noPrazo)} — prazo cumprido (elegível)
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </Painel>

        {contratoPadrao && detalhePadrao ? (
          <Painel
            titulo={`Contrato de teste padrão — ${contratoPadrao.codigo}`}
            descricao="Use este contrato para demonstrar cada trava isoladamente."
          >
            <div className="linha-acoes" style={{ marginBottom: 12 }}>
              <EtiquetaLiberacao status={detalhePadrao.avaliacao.status} />
              <EtiquetaModulo ativo={contratoPadrao.moduloFinanceiroAtivo} />
            </div>

            <dl className="definicoes">
              <div>
                <dt>Valor total e medido</dt>
                <dd className="numero">{formatarMoeda(detalhePadrao.resumo.totalMedidoCents)}</dd>
              </div>
              <div>
                <dt>Retenção</dt>
                <dd className="numero">
                  {formatarPercentual(contratoPadrao.percentualRetencao)} ={' '}
                  {formatarMoeda(detalhePadrao.resumo.principalRetidoCents)}
                </dd>
              </div>
              <div>
                <dt>Conclusão e aceite</dt>
                <dd>{formatarData(contratoPadrao.dataConclusao)}</dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>{contratoPadrao.prazoDiasCorridos} dias corridos</dd>
              </div>
              <div>
                <dt>Data mínima de liberação</dt>
                <dd>{formatarData(contratoPadrao.dataMinimaLiberacao)}</dd>
              </div>
            </dl>

            <div className="linha-acoes" style={{ marginTop: 14 }}>
              {disputa ? (
                <button
                  className="botao verde"
                  onClick={() =>
                    executar((e) =>
                      resolverDisputa(
                        e,
                        disputa.id,
                        'Disputa encerrada durante a demonstração, sem alteração de valores.',
                      ),
                    )
                  }
                >
                  Fechar disputa deste contrato
                </button>
              ) : (
                <button
                  className="botao perigo"
                  onClick={() =>
                    executar((e) =>
                      abrirDisputa(
                        e,
                        contratoPadrao.id,
                        'Disputa aberta durante a demonstração para mostrar a trava de liberação.',
                      ),
                    )
                  }
                >
                  Abrir disputa neste contrato
                </button>
              )}
              <button
                className="botao secundario"
                onClick={() => navegar(`/plataforma/contratos/${contratoPadrao.id}`)}
              >
                Abrir contrato
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <h3 style={{ marginBottom: 8 }}>Travas de liberação</h3>
              <ul className="checklist">
                {detalhePadrao.avaliacao.condicoes.map((c) => (
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
            </div>
          </Painel>
        ) : null}
      </div>
    </>
  )
}

// ------------------------------------------------------------------ Contratos administrados

export function ContratosPlataforma() {
  const { estado } = useDemo()
  const detalhados = useMemo(() => detalharTodos(estado), [estado])

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Contratos administrados</h1>
          <p className="descricao">
            Todos os contratos da demonstração, de todas as contratantes. Abra um contrato com módulo
            financeiro para simular o rendimento do próximo mês.
          </p>
        </div>
      </div>

      <Painel titulo={`Carteira (${detalhados.length} contratos)`} semEspaco>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Contratante</th>
                <th>Contratada</th>
                <th className="num">Saldo retido</th>
                <th className="num">Receita acumulada da plataforma</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detalhados.map((d) => (
                <tr key={d.contrato.id}>
                  <td>
                    <div className="titulo-linha">{d.contrato.codigo}</div>
                    <div className="sub-linha">{d.contrato.nome}</div>
                    <div style={{ marginTop: 4 }}>
                      <EtiquetaModulo ativo={d.contrato.moduloFinanceiroAtivo} />
                    </div>
                  </td>
                  <td>{d.contratante?.nome}</td>
                  <td>{d.contratada?.nome}</td>
                  <td className="num">{formatarMoeda(d.resumo.principalRetidoCents)}</td>
                  <td className="num">
                    {d.contrato.moduloFinanceiroAtivo
                      ? formatarMoeda(d.resumo.receitaPlataformaAcumuladaCents)
                      : '—'}
                  </td>
                  <td>
                    <EtiquetaLiberacao status={d.avaliacao.status} />
                  </td>
                  <td>
                    <div className="acoes-celula">
                      <button
                        className="botao secundario pequeno"
                        onClick={() => navegar(`/plataforma/contratos/${d.contrato.id}`)}
                      >
                        Abrir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
    </>
  )
}

// ------------------------------------------------------------------ Parâmetros

export function ConfiguracoesPlataforma() {
  const { estado, executar } = useDemo()
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [form, setForm] = useState({
    participacao: String(estado.configuracoes.participacaoPercentual).replace('.', ','),
    taxa: String(estado.configuracoes.taxaMensalPercentual).replace('.', ','),
  })

  const participacao = textoParaNumero(form.participacao)
  const taxa = textoParaNumero(form.taxa)

  // Demonstração do cálculo com o exemplo de referência de R$ 5.000 de principal.
  const exemploPrincipal = CONTRATO_PADRAO.retencaoCents
  const exemploBruto = taxa !== null ? Math.round((exemploPrincipal * taxa) / 100) : 0
  const exemploPlataforma = participacao !== null ? Math.round((exemploBruto * participacao) / 100) : 0
  const exemploContratada = exemploBruto - exemploPlataforma

  const enviar = () => {
    const dados = { participacaoPercentual: participacao, taxaMensalPercentual: taxa }
    const novosErros = validarConfiguracoes(dados)
    setErros(novosErros)
    if (temErros(novosErros)) return
    executar((e) =>
      salvarConfiguracoes(e, {
        participacaoPercentual: dados.participacaoPercentual as number,
        taxaMensalPercentual: dados.taxaMensalPercentual as number,
      }),
    )
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Parâmetros da simulação</h1>
          <p className="descricao">
            Valem apenas para contratos com <strong>módulo financeiro ativo</strong>. São hipóteses de
            demonstração: não representam taxas reais de mercado nem rentabilidade prometida.
          </p>
        </div>
        <div className="acoes">
          <button className="botao secundario" onClick={() => navegar('/plataforma/planos')}>
            Ver planos e mensalidades
          </button>
        </div>
      </div>

      <div className="duas-colunas">
        <Painel titulo="Hipóteses do módulo financeiro">
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault()
              enviar()
            }}
            noValidate
          >
            <Campo
              id="participacao"
              rotulo="Participação da plataforma no rendimento bruto (%)"
              erro={erros.participacao}
              dica="Hipótese inicial: 10%. Só incide em contratos com módulo financeiro."
            >
              <input
                id="participacao"
                inputMode="decimal"
                value={form.participacao}
                onChange={(e) => setForm({ ...form, participacao: e.target.value })}
              />
            </Campo>

            <Campo
              id="taxa"
              rotulo="Taxa mensal hipotética da aplicação (%)"
              erro={erros.taxa}
              dica="Hipótese inicial: 0,8% ao mês. Não é garantia de rentabilidade."
            >
              <input
                id="taxa"
                inputMode="decimal"
                value={form.taxa}
                onChange={(e) => setForm({ ...form, taxa: e.target.value })}
              />
            </Campo>

            <div className="linha-acoes">
              <button type="submit" className="botao primario">
                Salvar parâmetros
              </button>
            </div>

            <div className="nota">
              Alterações valem <strong>somente para simulações futuras</strong>. Os lançamentos já
              registrados guardam a taxa e a participação aplicadas na época e não são recalculados. A
              mensalidade do plano é cobrada à parte e não reduz o saldo da contratada.
            </div>
          </form>
        </Painel>

        <Painel
          titulo="Exemplo de cálculo"
          descricao={`Com um principal retido de ${formatarMoeda(exemploPrincipal)}.`}
        >
          <dl className="definicoes">
            <div>
              <dt>Principal</dt>
              <dd className="numero">{formatarMoeda(exemploPrincipal)}</dd>
            </div>
            <div>
              <dt>Taxa mensal hipotética</dt>
              <dd className="numero">{taxa !== null ? formatarPercentual(taxa) : '—'}</dd>
            </div>
            <div>
              <dt>Rendimento bruto</dt>
              <dd className="numero">{formatarMoeda(exemploBruto)}</dd>
            </div>
            <div>
              <dt>Participação da plataforma</dt>
              <dd className="numero">
                {participacao !== null ? formatarPercentual(participacao) : '—'} ={' '}
                {formatarMoeda(exemploPlataforma)}
              </dd>
            </div>
            <div>
              <dt>Rendimento da contratada</dt>
              <dd className="numero">{formatarMoeda(exemploContratada)}</dd>
            </div>
            <div>
              <dt>Saldo para liberação</dt>
              <dd className="numero">{formatarMoeda(exemploPrincipal + exemploContratada)}</dd>
            </div>
          </dl>
          <div className="nota" style={{ marginTop: 14 }}>
            A simulação desconsidera tributos e outros custos. Não há capitalização: a taxa incide
            sempre sobre o principal depositado. Contratos sem módulo financeiro não rendem nada e não
            geram participação.
          </div>
        </Painel>
      </div>
    </>
  )
}
