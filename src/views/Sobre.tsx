// Página de apoio à apresentação: o que a demonstração é, o que ela não é,
// e como os cálculos funcionam.

import { useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { CONTRATO_PADRAO } from '../domain/dadosIniciais'
import { formatarData } from '../domain/datas'
import { formatarMoeda, formatarPercentual } from '../domain/money'
import { IMPLANTACAO, PLANOS } from '../domain/planos'
import { Confirmacao, Painel } from '../components/Interface'

export function Sobre() {
  const { estado, restaurarDemonstracao, persistenciaAtiva } = useDemo()
  const [confirmando, setConfirmando] = useState(false)
  const config = estado.configuracoes

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Sobre esta demonstração</h1>
          <p className="descricao">
            TrustRetain é uma proposta de plataforma para a gestão compartilhada de retenções
            contratuais em obras de engenharia, infraestrutura e energia. Esta versão é um protótipo
            navegável para apresentação acadêmica.
          </p>
        </div>
      </div>

      <div className="duas-colunas">
        <Painel titulo="O que esta versão faz">
          <ul>
            <li>Registra contratos, medições e o cálculo automático da retenção.</li>
            <li>
              Controla documentos obrigatórios: envio, confirmação de recebimento, aprovação, recusa
              com motivo e reenvio, com histórico de versões.
            </li>
            <li>Verifica, item a item, as travas para liberar a retenção.</li>
            <li>Registra a solicitação da contratada e a confirmação da contratante.</li>
            <li>Importa cauções exportadas do ERP em CSV.</li>
            <li>
              Simula rendimento mensal <strong>apenas</strong> nos contratos com módulo financeiro
              ativo.
            </li>
            <li>Permite mover a data da simulação para mostrar o efeito das travas de prazo.</li>
          </ul>
        </Painel>

        <Painel titulo="O que esta versão não faz">
          <ul>
            <li>
              Não integra bancos, meios de pagamento ou produtos de investimento. Depósitos,
              aplicações, rendimentos e liberações são <strong>simulados</strong>.
            </li>
            <li>Não promete rentabilidade, nem elimina disputas contratuais.</li>
            <li>Não trata de efeitos contábeis ou fiscais dos valores retidos.</li>
            <li>Não tem login: o seletor de perfis existe apenas para a demonstração.</li>
            <li>Não armazena arquivos: o envio de documentos é simulado.</li>
            <li>Não compartilha dados entre pessoas: cada navegador tem a sua própria cópia.</li>
          </ul>
        </Painel>
      </div>

      <Painel
        titulo="Módulo financeiro: opcional por contrato"
        descricao="É o que separa a gestão da retenção da remuneração do valor retido."
      >
        <div className="duas-colunas">
          <div>
            <h3 style={{ marginBottom: 6 }}>Sem o módulo</h3>
            <p className="texto-pequeno">
              O contrato acompanha o saldo retido e as condições de liberação. Não há depósito em
              custódia, aplicação, rendimento nem participação da plataforma. A receita da TrustRetain
              vem só da mensalidade do plano.
            </p>
          </div>
          <div>
            <h3 style={{ marginBottom: 6 }}>Com o módulo</h3>
            <p className="texto-pequeno">
              Cada retenção precisa ter o depósito confirmado para entrar no saldo aplicado. O valor
              rende mensalmente, e a plataforma fica com{' '}
              {formatarPercentual(config.participacaoPercentual)} do rendimento bruto. O restante é da
              contratada.
            </p>
          </div>
        </div>
      </Painel>

      <Painel titulo="Como os cálculos funcionam">
        <dl className="definicoes">
          <div>
            <dt>Retenção</dt>
            <dd>valor da medição × percentual de retenção do contrato</dd>
          </div>
          <div>
            <dt>Saldo retido (sem módulo financeiro)</dt>
            <dd>soma das retenções das medições registradas</dd>
          </div>
          <div>
            <dt>Base do rendimento (com módulo)</dt>
            <dd>somente retenções com depósito confirmado e ainda não liberadas</dd>
          </div>
          <div>
            <dt>Rendimento bruto</dt>
            <dd>principal elegível × taxa mensal hipotética</dd>
          </div>
          <div>
            <dt>Receita da plataforma</dt>
            <dd>rendimento bruto × participação da plataforma</dd>
          </div>
          <div>
            <dt>Rendimento da contratada</dt>
            <dd>rendimento bruto − receita da plataforma</dd>
          </div>
          <div>
            <dt>Saldo para liberação</dt>
            <dd>saldo retido + rendimentos acumulados da contratada</dd>
          </div>
          <div>
            <dt>Prazo contratual</dt>
            <dd>dias corridos contados do dia seguinte à conclusão</dd>
          </div>
        </dl>

        <div className="nota" style={{ marginTop: 14 }}>
          Parâmetros atuais: participação de {formatarPercentual(config.participacaoPercentual)} sobre
          o rendimento bruto e taxa mensal hipotética de{' '}
          {formatarPercentual(config.taxaMensalPercentual)}. Sem capitalização, sem tributos e sem
          outros custos. Um clique em “Simular próximo mês” gera um único lançamento por período, e não
          há rendimento depois da liberação do contrato.
        </div>
      </Painel>

      <Painel
        titulo="Contrato de teste padrão"
        descricao={`${CONTRATO_PADRAO.codigo} — usado no roteiro para demonstrar cada trava isoladamente.`}
      >
        <dl className="definicoes">
          <div>
            <dt>Valor total e medido</dt>
            <dd className="numero">{formatarMoeda(CONTRATO_PADRAO.valorCents)}</dd>
          </div>
          <div>
            <dt>Retenção</dt>
            <dd className="numero">
              {formatarPercentual(CONTRATO_PADRAO.percentualRetencao)} ={' '}
              {formatarMoeda(CONTRATO_PADRAO.retencaoCents)}
            </dd>
          </div>
          <div>
            <dt>Conclusão e aceite</dt>
            <dd>{formatarData(CONTRATO_PADRAO.dataConclusao)}</dd>
          </div>
          <div>
            <dt>Prazo</dt>
            <dd>{CONTRATO_PADRAO.prazoDiasCorridos} dias corridos, do dia seguinte à conclusão</dd>
          </div>
          <div>
            <dt>Data mínima de liberação</dt>
            <dd>{formatarData(CONTRATO_PADRAO.dataMinimaLiberacao)}</dd>
          </div>
        </dl>
        <div className="nota" style={{ marginTop: 14 }}>
          Travas: documentos obrigatórios aprovados, aceite da entrega, prazo cumprido, ausência de
          disputa e saldo positivo. Qualquer uma delas, sozinha, impede a solicitação de liberação.
        </div>
      </Painel>

      <Painel titulo="Modelo de receita" descricao="Duas fontes, mantidas separadas nos indicadores.">
        <ul>
          <li>
            <strong>Mensalidade da contratante</strong>, por faixa de volume:{' '}
            {PLANOS.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? '; ' : ''}
                {p.nome} ({p.faixa.toLowerCase()}) {p.aPartirDe ? 'a partir de ' : ''}
                {formatarMoeda(p.precoMensalCents)} por mês
              </span>
            ))}
            .
          </li>
          <li>
            <strong>Implantação</strong>, cobrança única de {formatarMoeda(IMPLANTACAO.minimoCents)} a{' '}
            {formatarMoeda(IMPLANTACAO.maximoCents)}, conforme o volume e a integração necessária.
          </li>
          <li>
            <strong>Participação de {formatarPercentual(config.participacaoPercentual)}</strong> sobre
            o rendimento bruto, somente nos contratos com módulo financeiro ativo.
          </li>
          <li>
            <strong>Fornecedores convidados não pagam nada.</strong>
          </li>
        </ul>
      </Painel>

      <Painel titulo="Dados salvos neste navegador">
        <p>
          {persistenciaAtiva
            ? 'As alterações feitas aqui ficam salvas no armazenamento local deste navegador e continuam disponíveis se você atualizar a página.'
            : 'Este navegador está bloqueando o armazenamento local. A demonstração funciona normalmente, mas as alterações se perdem ao recarregar a página.'}
        </p>
        <p>
          <strong>Cada integrante do grupo tem a própria demonstração.</strong> O que uma pessoa
          altera no navegador dela não aparece para as outras. Isso é intencional nesta primeira
          versão: banco de dados compartilhado e autenticação ficaram fora do escopo.
        </p>
        <p className="texto-pequeno texto-mudo">
          Data da simulação neste navegador: {formatarData(estado.dataSimulacao)}. Ela substitui “hoje”
          em todas as travas de prazo e pode ser ajustada no perfil Plataforma.
        </p>
        <div className="linha-acoes">
          <button className="botao perigo" onClick={() => setConfirmando(true)}>
            ↺ Restaurar demonstração
          </button>
        </div>
      </Painel>

      {confirmando ? (
        <Confirmacao
          titulo="Restaurar a demonstração?"
          textoConfirmar="Sim, restaurar"
          tomConfirmar="perigo"
          mensagem={
            <p>
              Todas as alterações feitas neste navegador serão apagadas e os dados de exemplo voltarão
              ao estado inicial, inclusive a data da simulação. Esta ação não pode ser desfeita.
            </p>
          }
          aoConfirmar={() => {
            restaurarDemonstracao()
            setConfirmando(false)
          }}
          aoCancelar={() => setConfirmando(false)}
        />
      ) : null}
    </>
  )
}
