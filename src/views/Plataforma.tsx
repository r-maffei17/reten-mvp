// Visão da plataforma: carteira administrada, receitas simuladas e parâmetros da simulação.

import { useMemo, useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { salvarConfiguracoes } from '../domain/acoes'
import { formatarPeriodo, periodoAtual } from '../domain/datas'
import { formatarMoeda, formatarPercentual, textoParaCents, textoParaNumero } from '../domain/money'
import { calcularTotaisPlataforma, detalharTodos } from '../domain/selecoes'
import { temErros, validarConfiguracoes, type ErrosFormulario } from '../domain/validacoes'
import { CartaoIndicador, Campo, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao } from '../components/Status'

export function PainelPlataforma() {
  const { estado } = useDemo()
  const periodo = periodoAtual()
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
            Carteira administrada e receitas da simulação. As receitas mensais projetadas e as receitas
            acumuladas são apresentadas separadamente, sem somar períodos diferentes.
          </p>
        </div>
        <div className="acoes">
          <button className="botao secundario" onClick={() => navegar('/plataforma/configuracoes')}>
            Ajustar parâmetros
          </button>
        </div>
      </div>

      <div className="grade-indicadores">
        <CartaoIndicador
          rotulo="Contratantes cadastradas"
          valor={totais.contratantes}
          apoio="Empresas que pagam a mensalidade"
        />
        <CartaoIndicador
          rotulo="Contratos administrados"
          valor={totais.contratosAdministrados}
          apoio={`${totais.contratosLiberados} já liberados`}
        />
        <CartaoIndicador
          rotulo="Total de recursos retidos (simulado)"
          valor={formatarMoeda(totais.recursosRetidosCents)}
          apoio="Principal + rendimentos ainda retidos, posição atual"
        />
        <CartaoIndicador
          rotulo="Receita de assinaturas — projeção mensal"
          valor={formatarMoeda(totais.receitaAssinaturasMensalCents)}
          tom="verde"
          apoio={`${totais.contratantes} contratantes × ${formatarMoeda(estado.configuracoes.mensalidadeCents)} por mês`}
        />
        <CartaoIndicador
          rotulo="Participação nos rendimentos — acumulado"
          valor={formatarMoeda(totais.receitaParticipacaoAcumuladaCents)}
          tom="verde"
          apoio={`Soma de todos os períodos já lançados (${formatarPercentual(estado.configuracoes.participacaoPercentual)} do rendimento bruto)`}
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
        simulados. Os dois não devem ser somados em um único número.
      </div>

      <Painel
        titulo="Rendimentos simulados por período"
        descricao="Cada linha reúne os lançamentos de todos os contratos naquele mês."
        semEspaco
      >
        {porPeriodo.length === 0 ? (
          <Vazio
            simbolo="📊"
            titulo="Nenhum rendimento lançado"
            descricao="Use a ação “Simular próximo mês” dentro de um contrato para gerar lançamentos."
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

export function ContratosPlataforma() {
  const { estado } = useDemo()
  const detalhados = useMemo(() => detalharTodos(estado), [estado])

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Contratos administrados</h1>
          <p className="descricao">
            Todos os contratos da demonstração, de todas as contratantes. Abra um contrato para simular
            o rendimento do próximo mês.
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
                <th className="num">Principal retido</th>
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
                  </td>
                  <td>{d.contratante?.nome}</td>
                  <td>{d.contratada?.nome}</td>
                  <td className="num">{formatarMoeda(d.resumo.principalRetidoCents)}</td>
                  <td className="num">{formatarMoeda(d.resumo.receitaPlataformaAcumuladaCents)}</td>
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

export function ConfiguracoesPlataforma() {
  const { estado, executar } = useDemo()
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [form, setForm] = useState({
    mensalidade: (estado.configuracoes.mensalidadeCents / 100).toFixed(2).replace('.', ','),
    participacao: String(estado.configuracoes.participacaoPercentual).replace('.', ','),
    taxa: String(estado.configuracoes.taxaMensalPercentual).replace('.', ','),
  })

  const mensalidadeCents = textoParaCents(form.mensalidade)
  const participacao = textoParaNumero(form.participacao)
  const taxa = textoParaNumero(form.taxa)

  // Demonstração do cálculo com o exemplo de referência de R$ 5.000 de principal.
  const exemploPrincipal = 500000
  const exemploBruto = taxa !== null ? Math.round((exemploPrincipal * taxa) / 100) : 0
  const exemploPlataforma = participacao !== null ? Math.round((exemploBruto * participacao) / 100) : 0
  const exemploContratada = exemploBruto - exemploPlataforma

  const enviar = () => {
    const dados = {
      mensalidadeCents,
      participacaoPercentual: participacao,
      taxaMensalPercentual: taxa,
    }
    const novosErros = validarConfiguracoes(dados)
    setErros(novosErros)
    if (temErros(novosErros)) return
    executar((e) =>
      salvarConfiguracoes(e, {
        mensalidadeCents: dados.mensalidadeCents as number,
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
            Estes números são hipóteses usadas apenas para demonstrar o modelo. Não representam taxas
            reais de mercado, nem rentabilidade prometida.
          </p>
        </div>
      </div>

      <div className="duas-colunas">
        <Painel titulo="Hipóteses de demonstração">
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault()
              enviar()
            }}
            noValidate
          >
            <Campo
              id="mensalidade"
              rotulo="Mensalidade por contratante (R$)"
              erro={erros.mensalidade}
              dica="Valor ilustrativo inicial: R$ 499,00. Cobrada à parte, não reduz o saldo da contratada."
            >
              <input
                id="mensalidade"
                inputMode="decimal"
                value={form.mensalidade}
                onChange={(e) => setForm({ ...form, mensalidade: e.target.value })}
              />
            </Campo>

            <Campo
              id="participacao"
              rotulo="Participação da plataforma no rendimento bruto (%)"
              erro={erros.participacao}
              dica="Hipótese inicial: 10%."
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
              registrados guardam a taxa e a participação aplicadas na época e não são recalculados.
            </div>
          </form>
        </Painel>

        <Painel titulo="Exemplo de cálculo" descricao="Com um principal retido de R$ 5.000,00.">
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
            sempre sobre o principal depositado.
          </div>
        </Painel>
      </div>
    </>
  )
}
