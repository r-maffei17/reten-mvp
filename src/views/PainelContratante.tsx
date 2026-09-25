// Painel da contratante: visão geral da carteira e pendências prioritárias,
// cada uma com responsável, motivo e prazo.

import { useMemo } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { formatarData } from '../domain/datas'
import { formatarMoeda } from '../domain/money'
import { detalharTodos, listarPendenciasContratante } from '../domain/selecoes'
import { CartaoIndicador, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao, EtiquetaModulo } from '../components/Status'
import { ListaPendencias } from './Pendencias'

export function PainelContratante() {
  const { estado } = useDemo()

  const detalhados = useMemo(() => detalharTodos(estado), [estado])
  const pendencias = useMemo(() => listarPendenciasContratante(estado), [estado])

  const ativos = detalhados.filter((d) => !d.contrato.liberadoEm)
  const saldoRetido = detalhados.reduce((s, d) => s + d.resumo.principalRetidoCents, 0)
  const rendimentosRetidos = detalhados.reduce((s, d) => s + d.resumo.rendimentoRetidoCents, 0)
  const comModulo = detalhados.filter((d) => d.contrato.moduloFinanceiroAtivo).length
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
          <button className="botao secundario" onClick={() => navegar('/contratante/importar')}>
            ⇪ Importar cauções do ERP (CSV)
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
          apoio={`${detalhados.length} no total, ${detalhados.length - ativos.length} já liberados`}
        />
        <CartaoIndicador
          rotulo="Saldo retido"
          valor={formatarMoeda(saldoRetido)}
          apoio={`${comModulo} de ${detalhados.length} contratos com módulo financeiro`}
        />
        <CartaoIndicador
          rotulo="Rendimentos da contratada"
          valor={formatarMoeda(rendimentosRetidos)}
          apoio="Somente contratos com módulo financeiro ativo"
        />
        <CartaoIndicador
          rotulo="Documentos aguardando análise"
          valor={documentosAguardando}
          tom={documentosAguardando > 0 ? 'ambar' : undefined}
          apoio="Enviados pela contratada e pendentes de decisão"
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
      >
        {pendencias.length === 0 ? (
          <Vazio
            simbolo="✅"
            titulo="Nenhuma pendência no momento"
            descricao="Quando houver documento a analisar, depósito a confirmar ou liberação a decidir, o item aparece aqui."
          />
        ) : (
          <ListaPendencias
            pendencias={pendencias.slice(0, 12)}
            rotaBase="/contratante/contratos"
            dataReferencia={estado.dataSimulacao}
          />
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
                    <div style={{ marginTop: 4 }}>
                      <EtiquetaModulo ativo={d.contrato.moduloFinanceiroAtivo} />
                    </div>
                  </td>
                  <td>{d.contratada?.nome}</td>
                  <td>
                    <EtiquetaLiberacao status={d.avaliacao.status} />
                    {d.avaliacao.pendencias.length > 0 ? (
                      <div className="sub-linha">
                        Falta: {d.avaliacao.pendencias.map((p) => p.titulo).join('; ')}
                      </div>
                    ) : null}
                    <div className="sub-linha">
                      Prazo: {formatarData(d.contrato.dataMinimaLiberacao)}
                    </div>
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
