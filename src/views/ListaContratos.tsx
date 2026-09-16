// Lista de contratos da contratante, com busca por texto e filtro por situação.

import { useMemo, useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { formatarData } from '../domain/datas'
import { ROTULO_STATUS_LIBERACAO } from '../domain/elegibilidade'
import { formatarMoeda, formatarPercentual } from '../domain/money'
import { detalharTodos } from '../domain/selecoes'
import type { StatusLiberacao } from '../domain/types'
import { Campo, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao } from '../components/Status'

type FiltroSituacao = 'todas' | StatusLiberacao

export function ListaContratos() {
  const { estado } = useDemo()
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas')

  const detalhados = useMemo(() => detalharTodos(estado), [estado])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return detalhados.filter((d) => {
      const combinaSituacao = situacao === 'todas' || d.avaliacao.status === situacao
      if (!combinaSituacao) return false
      if (!termo) return true
      const alvo = [
        d.contrato.codigo,
        d.contrato.nome,
        d.contratada?.nome ?? '',
        d.contratante?.nome ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return alvo.includes(termo)
    })
  }, [detalhados, busca, situacao])

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Contratos</h1>
          <p className="descricao">
            {detalhados.length} contratos nesta demonstração. Use a busca e o filtro para chegar mais
            rápido ao contrato desejado.
          </p>
        </div>
        <div className="acoes">
          <button className="botao primario" onClick={() => navegar('/contratante/contratos/novo')}>
            + Cadastrar contrato
          </button>
        </div>
      </div>

      <Painel titulo="Buscar e filtrar">
        <div className="filtros">
          <Campo id="busca" rotulo="Buscar por código, nome ou empresa">
            <input
              id="busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: CT-2024-001 ou Subestação"
            />
          </Campo>
          <Campo id="filtro-situacao" rotulo="Situação da liberação">
            <select
              id="filtro-situacao"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as FiltroSituacao)}
            >
              <option value="todas">Todas as situações</option>
              <option value="bloqueada">{ROTULO_STATUS_LIBERACAO.bloqueada}</option>
              <option value="elegivel">{ROTULO_STATUS_LIBERACAO.elegivel}</option>
              <option value="solicitada">{ROTULO_STATUS_LIBERACAO.solicitada}</option>
              <option value="liberada">{ROTULO_STATUS_LIBERACAO.liberada}</option>
            </select>
          </Campo>
          {busca || situacao !== 'todas' ? (
            <button
              className="botao secundario"
              onClick={() => {
                setBusca('')
                setSituacao('todas')
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </Painel>

      <Painel titulo={`Resultados (${filtrados.length})`} semEspaco>
        {filtrados.length === 0 ? (
          <Vazio
            simbolo="🔍"
            titulo="Nenhum contrato encontrado"
            descricao="Ajuste a busca ou o filtro de situação para ver outros contratos da demonstração."
            acao={
              <button
                className="botao secundario"
                onClick={() => {
                  setBusca('')
                  setSituacao('todas')
                }}
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Contratada</th>
                  <th className="num">Valor total</th>
                  <th className="num">Retenção</th>
                  <th className="num">Saldo retido</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.contrato.id}>
                    <td>
                      <div className="titulo-linha">{d.contrato.codigo}</div>
                      <div className="sub-linha">{d.contrato.nome}</div>
                      <div className="sub-linha">
                        Liberação a partir de {formatarData(d.contrato.dataMinimaLiberacao)}
                      </div>
                    </td>
                    <td>{d.contratada?.nome}</td>
                    <td className="num">{formatarMoeda(d.contrato.valorTotalCents)}</td>
                    <td className="num">{formatarPercentual(d.contrato.percentualRetencao)}</td>
                    <td className="num">{formatarMoeda(d.resumo.saldoParaLiberacaoCents)}</td>
                    <td>
                      <EtiquetaLiberacao status={d.avaliacao.status} />
                    </td>
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
        )}
      </Painel>
    </>
  )
}
