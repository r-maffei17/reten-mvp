// Lista de contratos da contratante, com busca por texto e filtros por situação
// e por módulo financeiro.

import { useMemo, useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { formatarData } from '../domain/datas'
import { ROTULO_STATUS_LIBERACAO } from '../domain/elegibilidade'
import { formatarMoeda, formatarPercentual } from '../domain/money'
import { detalharTodos } from '../domain/selecoes'
import type { StatusLiberacao } from '../domain/types'
import { Campo, Painel, Vazio } from '../components/Interface'
import { EtiquetaLiberacao, EtiquetaModulo } from '../components/Status'

type FiltroSituacao = 'todas' | StatusLiberacao
type FiltroModulo = 'todos' | 'com' | 'sem'

export function ListaContratos() {
  const { estado } = useDemo()
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas')
  const [modulo, setModulo] = useState<FiltroModulo>('todos')

  const detalhados = useMemo(() => detalharTodos(estado), [estado])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return detalhados.filter((d) => {
      if (situacao !== 'todas' && d.avaliacao.status !== situacao) return false
      if (modulo === 'com' && !d.contrato.moduloFinanceiroAtivo) return false
      if (modulo === 'sem' && d.contrato.moduloFinanceiroAtivo) return false
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
  }, [detalhados, busca, situacao, modulo])

  const limpar = () => {
    setBusca('')
    setSituacao('todas')
    setModulo('todos')
  }
  const temFiltro = busca !== '' || situacao !== 'todas' || modulo !== 'todos'

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Contratos</h1>
          <p className="descricao">
            {detalhados.length} contratos nesta demonstração. Use a busca e os filtros para chegar mais
            rápido ao contrato desejado.
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

      <Painel titulo="Buscar e filtrar">
        <div className="filtros">
          <Campo id="busca" rotulo="Buscar por código, nome ou empresa">
            <input
              id="busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: CT-2026-100 ou Subestação"
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
          <Campo id="filtro-modulo" rotulo="Módulo financeiro">
            <select
              id="filtro-modulo"
              value={modulo}
              onChange={(e) => setModulo(e.target.value as FiltroModulo)}
            >
              <option value="todos">Todos os contratos</option>
              <option value="com">Com módulo financeiro</option>
              <option value="sem">Sem módulo financeiro</option>
            </select>
          </Campo>
          {temFiltro ? (
            <button className="botao secundario" onClick={limpar}>
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
            descricao="Ajuste a busca ou os filtros para ver outros contratos da demonstração."
            acao={
              <button className="botao secundario" onClick={limpar}>
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
                      <div style={{ marginTop: 4 }}>
                        <EtiquetaModulo ativo={d.contrato.moduloFinanceiroAtivo} />
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
