// Visão da contratada: apenas os contratos da empresa selecionada.
// A tela inicial abre pelas pendências, com responsável, motivo e prazo em cada item.

import { useMemo } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { formatarData } from '../domain/datas'
import { formatarMoeda } from '../domain/money'
import { detalharTodos, listarPendenciasContratada } from '../domain/selecoes'
import { CartaoIndicador, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao, EtiquetaModulo } from '../components/Status'
import { ListaPendencias } from './Pendencias'

function SeletorContratada() {
  const { estado, contratadaSelecionadaId, definirContratadaSelecionada } = useDemo()
  return (
    <div className="campo" style={{ minWidth: 260 }}>
      <label htmlFor="seletor-contratada">Empresa contratada (exemplo)</label>
      <select
        id="seletor-contratada"
        value={contratadaSelecionadaId}
        onChange={(e) => definirContratadaSelecionada(e.target.value)}
      >
        {estado.contratadas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  )
}

function useContratosDaContratada() {
  const { estado, contratadaSelecionadaId } = useDemo()
  return useMemo(
    () => detalharTodos(estado).filter((d) => d.contrato.contratadaId === contratadaSelecionadaId),
    [estado, contratadaSelecionadaId],
  )
}

export function PainelContratada() {
  const { estado, contratadaSelecionadaId } = useDemo()
  const contratos = useContratosDaContratada()
  const pendencias = useMemo(
    () => listarPendenciasContratada(estado, contratadaSelecionadaId),
    [estado, contratadaSelecionadaId],
  )

  const empresa = estado.contratadas.find((c) => c.id === contratadaSelecionadaId)
  const principalRetido = contratos.reduce((s, d) => s + d.resumo.principalRetidoCents, 0)
  const rendimentos = contratos.reduce((s, d) => s + d.resumo.rendimentoRetidoCents, 0)
  const saldoTotal = principalRetido + rendimentos
  const liberado = contratos.reduce((s, d) => s + d.resumo.totalLiberadoCents, 0)
  const temModulo = contratos.some((d) => d.contrato.moduloFinanceiroAtivo)

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Painel da contratada</h1>
          <p className="descricao">
            {empresa ? `Contratos de ${empresa.nome}` : ''} — o que precisa da sua ação aparece primeiro,
            com responsável, motivo e prazo.
          </p>
        </div>
        <div className="acoes">
          <SeletorContratada />
        </div>
      </div>

      <Painel
        titulo={`Pendências para liberação (${pendencias.length})`}
        descricao="O que precisa acontecer, em ordem, para o saldo ser liberado."
      >
        {pendencias.length === 0 ? (
          <Vazio
            simbolo="✅"
            titulo="Nada pendente para esta contratada"
            descricao="Assim que houver documento a enviar ou condição a cumprir, o item aparece aqui."
          />
        ) : (
          <ListaPendencias
            pendencias={pendencias}
            rotaBase="/contratada/contratos"
            dataReferencia={estado.dataSimulacao}
          />
        )}
      </Painel>

      <div className="grade-indicadores">
        <CartaoIndicador
          rotulo="Saldo retido"
          valor={formatarMoeda(principalRetido)}
          apoio="Retenções ainda não liberadas"
        />
        {temModulo ? (
          <CartaoIndicador
            rotulo="Rendimentos destinados à contratada"
            valor={formatarMoeda(rendimentos)}
            tom="verde"
            apoio="Somente contratos com módulo financeiro ativo"
          />
        ) : null}
        <CartaoIndicador
          rotulo="Saldo total ainda retido"
          valor={formatarMoeda(saldoTotal)}
          apoio={temModulo ? 'Retenções + rendimentos ainda não liberados' : 'Retenções ainda não liberadas'}
        />
        <CartaoIndicador
          rotulo="Valores já liberados"
          valor={formatarMoeda(liberado)}
          apoio="Liberações simuladas confirmadas pela contratante"
        />
      </div>

      <ListaContratosContratada />
    </>
  )
}

function ListaContratosContratada() {
  const contratos = useContratosDaContratada()
  if (contratos.length === 0) {
    return (
      <Painel titulo="Contratos" semEspaco>
        <Vazio
          simbolo="📄"
          titulo="Esta contratada não tem contratos na demonstração"
          descricao="Troque a empresa no seletor acima para ver outro exemplo."
        />
      </Painel>
    )
  }
  const algumComModulo = contratos.some((d) => d.contrato.moduloFinanceiroAtivo)
  return (
    <Painel titulo="Meus contratos" semEspaco>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Contratante</th>
              <th className="num">Saldo retido</th>
              {algumComModulo ? <th className="num">Rendimentos</th> : null}
              <th className="num">Saldo para liberação</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contratos.map((d) => (
              <tr key={d.contrato.id}>
                <td>
                  <div className="titulo-linha">{d.contrato.codigo}</div>
                  <div className="sub-linha">{d.contrato.nome}</div>
                  <div className="sub-linha">
                    Liberação a partir de {formatarData(d.contrato.dataMinimaLiberacao)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <EtiquetaModulo ativo={d.contrato.moduloFinanceiroAtivo} />
                  </div>
                </td>
                <td>{d.contratante?.nome}</td>
                <td className="num">{formatarMoeda(d.resumo.principalRetidoCents)}</td>
                {algumComModulo ? (
                  <td className="num">
                    {d.contrato.moduloFinanceiroAtivo
                      ? formatarMoeda(d.resumo.rendimentoRetidoCents)
                      : '—'}
                  </td>
                ) : null}
                <td className="num">{formatarMoeda(d.resumo.saldoParaLiberacaoCents)}</td>
                <td>
                  <EtiquetaLiberacao status={d.avaliacao.status} />
                </td>
                <td>
                  <div className="acoes-celula">
                    <button
                      className="botao secundario pequeno"
                      onClick={() => navegar(`/contratada/contratos/${d.contrato.id}`)}
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
  )
}

export function ContratosContratada() {
  const { estado, contratadaSelecionadaId } = useDemo()
  const empresa = estado.contratadas.find((c) => c.id === contratadaSelecionadaId)
  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Meus contratos</h1>
          <p className="descricao">
            {empresa ? `Somente os contratos de ${empresa.nome} são exibidos.` : ''} Troque a empresa
            para ver outro exemplo.
          </p>
        </div>
        <div className="acoes">
          <SeletorContratada />
        </div>
      </div>
      <ListaContratosContratada />
    </>
  )
}
