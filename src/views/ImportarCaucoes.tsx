// Importação de cauções exportadas do ERP, em CSV.
//
// O arquivo pode ser escolhido no computador ou colado na área de texto — a área
// já vem preenchida com o exemplo, para que a demonstração funcione sem depender
// de nenhum arquivo. Nada é enviado para fora do navegador.

import { useMemo, useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { importarCaucoes } from '../domain/acoes'
import { CSV_EXEMPLO, lerCsvCaucoes } from '../domain/csv'
import { formatarData } from '../domain/datas'
import { formatarMoeda, formatarPercentual } from '../domain/money'
import { Campo, Painel } from '../components/Interface'

export function ImportarCaucoes() {
  const { estado, executar, notificar } = useDemo()
  const [texto, setTexto] = useState(CSV_EXEMPLO)
  const [contratanteId, setContratanteId] = useState(estado.contratantes[0]?.id ?? '')
  const [comModulo, setComModulo] = useState(false)

  const leitura = useMemo(() => lerCsvCaucoes(texto), [texto])
  const comErro = leitura.linhas.filter((l) => l.erro)

  const carregarArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return
    try {
      const conteudo = await arquivo.text()
      setTexto(conteudo)
      notificar('info', `Arquivo "${arquivo.name}" carregado. Confira a prévia antes de importar.`)
    } catch {
      notificar('erro', 'Não foi possível ler o arquivo. Cole o conteúdo na área de texto.')
    }
  }

  const baixarExemplo = () => {
    try {
      const blob = new Blob([CSV_EXEMPLO], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'caucoes-exemplo.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      notificar(
        'info',
        'Este navegador bloqueou o download. O conteúdo do exemplo já está na área de texto abaixo.',
      )
    }
  }

  const importar = () => {
    if (leitura.erroGeral) {
      notificar('erro', leitura.erroGeral)
      return
    }
    if (leitura.validas.length === 0) {
      notificar('erro', 'Nenhuma linha válida para importar. Corrija os erros apontados na prévia.')
      return
    }
    const ok = executar((e) =>
      importarCaucoes(e, leitura.validas, { contratanteId, moduloFinanceiroAtivo: comModulo }),
    )
    if (ok) navegar('/contratante/contratos')
  }

  return (
    <>
      <button className="migalha" onClick={() => navegar('/contratante/contratos')}>
        ← Voltar para a lista de contratos
      </button>

      <div className="cabecalho-pagina">
        <div>
          <h1>Importar cauções do ERP (CSV)</h1>
          <p className="descricao">
            Cada linha do arquivo vira um contrato com uma medição já registrada. Fornecedores que
            ainda não existem são cadastrados automaticamente como contratadas convidadas — que não
            pagam nada pela plataforma.
          </p>
        </div>
      </div>

      <Painel
        titulo="1. Arquivo"
        descricao="Colunas exigidas: contrato, fornecedor, valor medido, percentual, valor retido, vencimento."
        acoes={
          <button className="botao secundario pequeno" onClick={baixarExemplo}>
            ⬇ Baixar arquivo de exemplo
          </button>
        }
      >
        <div className="formulario">
          <Campo
            id="arquivo-csv"
            rotulo="Escolher arquivo do computador"
            dica="Aceita separador ponto e vírgula ou vírgula, valores no formato brasileiro e datas em dia/mês/ano."
          >
            <input
              id="arquivo-csv"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => carregarArquivo(e.target.files?.[0])}
            />
          </Campo>

          <Campo
            id="conteudo-csv"
            rotulo="Ou cole o conteúdo do CSV aqui"
            dica="Já preenchido com o exemplo. Edite à vontade: a prévia abaixo é recalculada a cada alteração."
          >
            <textarea
              id="conteudo-csv"
              className="csv"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              spellCheck={false}
            />
          </Campo>

          <div className="linha-acoes">
            <button className="botao secundario pequeno" onClick={() => setTexto(CSV_EXEMPLO)}>
              Restaurar o exemplo
            </button>
            <button className="botao secundario pequeno" onClick={() => setTexto('')}>
              Limpar
            </button>
          </div>
        </div>
      </Painel>

      <Painel titulo="2. Destino da importação">
        <div className="grade-campos">
          <Campo id="contratante-import" rotulo="Contratante">
            <select
              id="contratante-import"
              value={contratanteId}
              onChange={(e) => setContratanteId(e.target.value)}
            >
              {estado.contratantes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            id="modulo-import"
            rotulo="Módulo financeiro nos contratos importados"
            dica={
              comModulo
                ? 'Com o módulo ativo, cada retenção precisa ter o depósito confirmado para render e para liberar.'
                : 'Sem o módulo, os contratos acompanham apenas o saldo retido e as condições de liberação.'
            }
          >
            <select
              id="modulo-import"
              value={comModulo ? 'sim' : 'nao'}
              onChange={(e) => setComModulo(e.target.value === 'sim')}
            >
              <option value="nao">Não ativar (apenas acompanhar a retenção)</option>
              <option value="sim">Ativar módulo financeiro</option>
            </select>
          </Campo>
        </div>
      </Painel>

      <Painel
        titulo={`3. Prévia (${leitura.validas.length} linha(s) válida(s), ${comErro.length} com erro)`}
        semEspaco
        acoes={
          <button
            className="botao primario"
            onClick={importar}
            disabled={leitura.validas.length === 0}
          >
            Importar {leitura.validas.length} caução(ões)
          </button>
        }
      >
        {leitura.erroGeral ? (
          <div className="painel-corpo">
            <div className="aviso-bloqueio">{leitura.erroGeral}</div>
          </div>
        ) : leitura.linhas.length === 0 ? (
          <div className="painel-corpo">
            <div className="nota">
              Nenhuma linha de dados encontrada. Cole o conteúdo do CSV ou escolha um arquivo.
            </div>
          </div>
        ) : (
          <div className="tabela-rolagem previa-csv">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Contrato</th>
                  <th>Fornecedor</th>
                  <th className="num">Valor medido</th>
                  <th className="num">Percentual</th>
                  <th className="num">Valor retido</th>
                  <th>Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {leitura.linhas.map((l) => (
                  <tr key={l.numero} className={l.erro ? 'linha-erro' : undefined}>
                    <td>{l.numero}</td>
                    {l.erro ? (
                      <td colSpan={6}>
                        <strong>Linha ignorada:</strong> {l.erro}
                      </td>
                    ) : (
                      <>
                        <td>
                          <div className="titulo-linha">{l.linha!.contrato}</div>
                        </td>
                        <td>{l.linha!.fornecedor}</td>
                        <td className="num">{formatarMoeda(l.linha!.valorMedidoCents)}</td>
                        <td className="num">{formatarPercentual(l.linha!.percentual)}</td>
                        <td className="num">{formatarMoeda(l.linha!.valorRetidoCents)}</td>
                        <td>{formatarData(l.linha!.vencimento)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div className="nota">
        A importação confere, linha a linha, se o valor retido bate com o percentual informado sobre o
        valor medido, se o percentual está entre 0 e 100, se a data é válida e se o código do contrato
        ainda não existe. Linhas com problema são ignoradas e o motivo aparece na prévia.
      </div>
    </>
  )
}
