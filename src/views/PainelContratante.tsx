// Painel da contratante: visão geral da carteira de contratos e pendências prioritárias.

import { useMemo } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { formatarMoeda } from '../domain/money'
import { detalharTodos, listarPendenciasContratante } from '../domain/selecoes'
import { CartaoIndicador, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao } from '../components/Status'

export function PainelContratante() {
  const { estado } = useDemo()

  const detalhados = useMemo(() => detalharTodos(estado), [estado])
  const pendencias = useMemo(() => listarPendenciasContratante(estado), [estado])

  const ativos = detalhados.filter((d) => !d.contrato.liberadoEm)
  const principalRetido = detalhados.reduce((s, d) => s + d.resumo.principalRetidoCents, 0)
  const rendimentosRetidos = detalhados.reduce((s, d) => s + d.resumo.rendimentoRetidoCents, 0)
  const documentosAguardando = estado.documentos.filter((d) => d.status === 'enviado').length
  const elegiveis = detalhados.filter((d) => d.avaliacao.status === 'elegivel')
  const solicitadas = detalhados.filter((d) => d.avaliacao.status === 'solicitada')
  const totalLiberado = detalhados.reduce((s, d) => s + d.resumo.totalLiberadoCents, 0)

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Painel da contratante</h1>
          <p className="descricao">
            Acompanhe os valores retidos, o que está pendente de análise e quais contratos já podem ter
            a retenção liberada.
          </p>
        </div>
        <div className="acoes">
          <button className="botao secundario" onClick={() => navegar('/contratante/contratos')}>
            Ver contratos
          </button>
          <button className="botao primario" onClick={() => navegar('/contratante/contratos/novo')}>
            + Cadastrar contrato
          </button>
        </div>
      </div>

      <div className="grade-indicadores">
        <CartaoIndicador
          rotulo="Contratos ativos"
          valor={ativos.length}
          apoio={`${detalhados.length} contratos no total, ${detalhados.length - ativos.length} já liberados`}
        />
        <CartaoIndicador
          rotulo="Saldo principal retido"
          valor={formatarMoeda(principalRetido)}
          apoio={`+ ${formatarMoeda(rendimentosRetidos)} em rendimentos da contratada`}
        />
        <CartaoIndicador
          rotulo="Documentos aguardando análise"
          valor={documentosAguardando}
          tom={documentosAguardando > 0 ? 'ambar' : undefined}
          apoio="Enviados pela contratada e pendentes de aprovação"
        />
        <CartaoIndicador
          rotulo="Contratos elegíveis para liberação"
          valor={elegiveis.length}
          tom={elegiveis.length > 0 ? 'verde' : undefined}
          apoio={`${solicitadas.length} com liberação já solicitada`}
        />
        <CartaoIndicador
          rotulo="Total já liberado"
          valor={formatarMoeda(totalLiberado)}
          apoio="Soma das liberações simuladas confirmadas"
        />
      </div>

      <Painel
        titulo="Pendências prioritárias"
        descricao="Ordenadas do que trava o recebimento para o que é apenas acompanhamento."
        semEspaco
      >
        {pendencias.length === 0 ? (
          <Vazio
            simbolo="✅"
            titulo="Nenhuma pendência no momento"
            descricao="Quando houver documento a analisar, depósito a confirmar ou liberação a decidir, o item aparece aqui."
          />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pendência</th>
                  <th>Contrato</th>
                  <th>Contratada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendencias.slice(0, 12).map((p, indice) => (
                  <tr key={`${p.contratoId}-${indice}`}>
                    <td>
                      <div className="titulo-linha">{p.titulo}</div>
                      <div className="sub-linha">{p.detalhe}</div>
                    </td>
                    <td>
                      <div className="titulo-linha">{p.codigo}</div>
                      <div className="sub-linha">{p.nomeContrato}</div>
                    </td>
                    <td>{p.empresa}</td>
                    <td>
                      <div className="acoes-celula">
                        <button
                          className="botao secundario pequeno"
                          onClick={() => navegar(`/contratante/contratos/${p.contratoId}`)}
                        >
                          Abrir contrato
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <Painel titulo="Situação da liberação por contrato" semEspaco>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Contratada</th>
                <th>Situação da liberação</th>
                <th className="num">Saldo retido</th>
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
                  <td>{d.contratada?.nome}</td>
                  <td>
                    <EtiquetaLiberacao status={d.avaliacao.status} />
                    {d.avaliacao.pendencias.length > 0 ? (
                      <div className="sub-linha">
                        Falta: {d.avaliacao.pendencias.map((p) => p.titulo).join('; ')}
                      </div>
                    ) : null}
                  </td>
                  <td className="num">{formatarMoeda(d.resumo.saldoParaLiberacaoCents)}</td>
                  <td>
                    <div className="acoes-celula">
                      <button
                        className="botao secundario pequeno"
                        onClick={() => navegar(`/contratante/contratos/${d.contrato.id}`)}
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
