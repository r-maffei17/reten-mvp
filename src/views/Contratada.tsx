// Visão da contratada: apenas os contratos da empresa selecionada.

import { useMemo } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { formatarData } from '../domain/datas'
import { formatarMoeda } from '../domain/money'
import { detalharTodos, listarPendenciasContratada } from '../domain/selecoes'
import { CartaoIndicador, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao } from '../components/Status'

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

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Painel da contratada</h1>
          <p className="descricao">
            {empresa ? `Contratos de ${empresa.nome}.` : ''} Acompanhe quanto está retido, quanto já
            rendeu e o que falta para receber.
          </p>
        </div>
        <div className="acoes">
          <SeletorContratada />
        </div>
      </div>

      <div className="grade-indicadores">
        <CartaoIndicador
          rotulo="Principal retido"
          valor={formatarMoeda(principalRetido)}
          apoio="Retenções com depósito simulado confirmado"
        />
        <CartaoIndicador
          rotulo="Rendimentos destinados à contratada"
          valor={formatarMoeda(rendimentos)}
          tom="verde"
          apoio="Rendimento bruto menos a participação da plataforma"
        />
        <CartaoIndicador
          rotulo="Saldo total ainda retido"
          valor={formatarMoeda(saldoTotal)}
          apoio="Principal + rendimentos ainda não liberados"
        />
        <CartaoIndicador
          rotulo="Valores já liberados"
          valor={formatarMoeda(liberado)}
          apoio="Liberações simuladas confirmadas pela contratante"
        />
        <CartaoIndicador
          rotulo="Pendências para liberação"
          valor={pendencias.length}
          tom={pendencias.length > 0 ? 'ambar' : undefined}
          apoio="Itens que precisam ser resolvidos para receber"
        />
      </div>

      <Painel
        titulo="Pendências para liberação"
        descricao="O que precisa acontecer, em ordem, para o saldo ser liberado."
        semEspaco
      >
        {pendencias.length === 0 ? (
          <Vazio
            simbolo="✅"
            titulo="Nada pendente para esta contratada"
            descricao="Assim que houver documento a enviar ou condição a cumprir, o item aparece aqui."
          />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pendência</th>
                  <th>Contrato</th>
                  <th>Contratante</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendencias.map((p, indice) => (
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
                          onClick={() => navegar(`/contratada/contratos/${p.contratoId}`)}
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
  return (
    <Painel titulo="Meus contratos" semEspaco>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Contratante</th>
              <th className="num">Principal retido</th>
              <th className="num">Rendimentos</th>
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
                </td>
                <td>{d.contratante?.nome}</td>
                <td className="num">{formatarMoeda(d.resumo.principalRetidoCents)}</td>
                <td className="num">{formatarMoeda(d.resumo.rendimentoRetidoCents)}</td>
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
