// Cadastro de contrato. Todos os campos são validados antes de gravar.

import { useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import { criarContrato } from '../domain/acoes'
import { hojeISO, somarMeses } from '../domain/datas'
import { formatarMoeda, textoParaCents, textoParaNumero } from '../domain/money'
import { temErros, validarContrato, type ErrosFormulario } from '../domain/validacoes'
import { Campo, Painel } from '../components/Interface'

export function NovoContrato() {
  const { estado, executar } = useDemo()
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [form, setForm] = useState({
    nome: '',
    codigo: '',
    contratanteId: estado.contratantes[0]?.id ?? '',
    contratadaId: estado.contratadas[0]?.id ?? '',
    valorTotal: '',
    percentualRetencao: '5',
    dataInicio: hojeISO(),
    dataTermino: somarMeses(hojeISO(), 12),
    dataMinimaLiberacao: somarMeses(hojeISO(), 14),
    condicoesLiberacao:
      'Liberação integral após o aceite da entrega, aprovação de todos os documentos obrigatórios e decurso do prazo contratual.',
  })

  const atualizar = (campo: keyof typeof form) => (valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const valorTotalCents = textoParaCents(form.valorTotal)
  const percentual = textoParaNumero(form.percentualRetencao)
  const retencaoIlustrativa =
    valorTotalCents !== null && percentual !== null && percentual >= 0 && percentual <= 100
      ? Math.round((valorTotalCents * percentual) / 100)
      : null

  const enviar = () => {
    const dados = {
      nome: form.nome,
      codigo: form.codigo,
      contratanteId: form.contratanteId,
      contratadaId: form.contratadaId,
      valorTotalCents,
      percentualRetencao: percentual,
      dataInicio: form.dataInicio,
      dataTermino: form.dataTermino,
      dataMinimaLiberacao: form.dataMinimaLiberacao,
      condicoesLiberacao: form.condicoesLiberacao,
    }
    const novosErros = validarContrato(dados, estado.contratos)
    setErros(novosErros)
    if (temErros(novosErros)) return

    const ok = executar((e) =>
      criarContrato(e, {
        nome: dados.nome,
        codigo: dados.codigo,
        contratanteId: dados.contratanteId,
        contratadaId: dados.contratadaId,
        valorTotalCents: dados.valorTotalCents as number,
        percentualRetencao: dados.percentualRetencao as number,
        dataInicio: dados.dataInicio,
        dataTermino: dados.dataTermino,
        dataMinimaLiberacao: dados.dataMinimaLiberacao,
        condicoesLiberacao: dados.condicoesLiberacao,
      }),
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
          <h1>Cadastrar contrato</h1>
          <p className="descricao">
            O percentual informado passa a ser aplicado automaticamente sobre cada medição registrada
            neste contrato.
          </p>
        </div>
      </div>

      <Painel titulo="Dados do contrato">
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
          noValidate
        >
          <div className="grade-campos">
            <Campo id="nome" rotulo="Nome do contrato" erro={erros.nome}>
              <input
                id="nome"
                value={form.nome}
                onChange={(e) => atualizar('nome')(e.target.value)}
                placeholder="Ex.: Subestação Norte 138 kV"
              />
            </Campo>
            <Campo id="codigo" rotulo="Código do contrato" erro={erros.codigo}>
              <input
                id="codigo"
                value={form.codigo}
                onChange={(e) => atualizar('codigo')(e.target.value)}
                placeholder="Ex.: CT-2026-010"
              />
            </Campo>
          </div>

          <div className="grade-campos">
            <Campo id="contratante" rotulo="Contratante" erro={erros.contratanteId}>
              <select
                id="contratante"
                value={form.contratanteId}
                onChange={(e) => atualizar('contratanteId')(e.target.value)}
              >
                {estado.contratantes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="contratada" rotulo="Contratada" erro={erros.contratadaId}>
              <select
                id="contratada"
                value={form.contratadaId}
                onChange={(e) => atualizar('contratadaId')(e.target.value)}
              >
                {estado.contratadas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="grade-campos">
            <Campo
              id="valor-total"
              rotulo="Valor total do contrato (R$)"
              erro={erros.valorTotal}
              dica="Use vírgula para os centavos. Ex.: 1.000.000,00"
            >
              <input
                id="valor-total"
                inputMode="decimal"
                value={form.valorTotal}
                onChange={(e) => atualizar('valorTotal')(e.target.value)}
                placeholder="Ex.: 1.000.000,00"
              />
            </Campo>
            <Campo
              id="percentual"
              rotulo="Percentual de retenção (%)"
              erro={erros.percentualRetencao}
              dica="Valor entre 0 e 100. Ex.: 5"
            >
              <input
                id="percentual"
                inputMode="decimal"
                value={form.percentualRetencao}
                onChange={(e) => atualizar('percentualRetencao')(e.target.value)}
              />
            </Campo>
          </div>

          {retencaoIlustrativa !== null ? (
            <div className="nota">
              Se todo o valor do contrato fosse medido, a retenção acumulada chegaria a{' '}
              <strong>{formatarMoeda(retencaoIlustrativa)}</strong>. A retenção é calculada medição a
              medição.
            </div>
          ) : null}

          <div className="grade-campos">
            <Campo id="data-inicio" rotulo="Data de início" erro={erros.dataInicio}>
              <input
                id="data-inicio"
                type="date"
                value={form.dataInicio}
                onChange={(e) => atualizar('dataInicio')(e.target.value)}
              />
            </Campo>
            <Campo id="data-termino" rotulo="Data de término" erro={erros.dataTermino}>
              <input
                id="data-termino"
                type="date"
                value={form.dataTermino}
                onChange={(e) => atualizar('dataTermino')(e.target.value)}
              />
            </Campo>
            <Campo
              id="data-minima"
              rotulo="Data mínima para liberação"
              erro={erros.dataMinimaLiberacao}
              dica="Antes desta data a liberação fica bloqueada."
            >
              <input
                id="data-minima"
                type="date"
                value={form.dataMinimaLiberacao}
                onChange={(e) => atualizar('dataMinimaLiberacao')(e.target.value)}
              />
            </Campo>
          </div>

          <Campo
            id="condicoes"
            rotulo="Condições de liberação"
            erro={erros.condicoesLiberacao}
            dica="Texto exibido às duas partes no detalhe do contrato."
          >
            <textarea
              id="condicoes"
              value={form.condicoesLiberacao}
              onChange={(e) => atualizar('condicoesLiberacao')(e.target.value)}
            />
          </Campo>

          <div className="linha-acoes">
            <button type="submit" className="botao primario">
              Cadastrar contrato
            </button>
            <button
              type="button"
              className="botao secundario"
              onClick={() => navegar('/contratante/contratos')}
            >
              Cancelar
            </button>
          </div>
        </form>
      </Painel>
    </>
  )
}
