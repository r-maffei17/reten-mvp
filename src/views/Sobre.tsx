// Página de apoio à apresentação: o que a demonstração é, o que ela não é,
// e como os cálculos funcionam.

import { useState } from 'react'
import { useDemo } from '../app/DemoContexto'
import { formatarMoeda, formatarPercentual } from '../domain/money'
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
            Reten é uma proposta de plataforma para a gestão compartilhada de retenções contratuais em
            obras de engenharia, infraestrutura e energia. Esta versão é um protótipo navegável para
            apresentação acadêmica.
          </p>
        </div>
      </div>

      <div className="duas-colunas">
        <Painel titulo="O que esta versão faz">
          <ul>
            <li>Registra contratos, medições e o cálculo automático da retenção.</li>
            <li>Controla documentos obrigatórios: envio, aprovação, rejeição e reenvio.</li>
            <li>Simula o rendimento mensal sobre o principal efetivamente depositado.</li>
            <li>Verifica, item a item, as condições para liberar a retenção.</li>
            <li>Registra a solicitação da contratada e a confirmação da contratante.</li>
            <li>Guarda o histórico de cada contrato.</li>
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

      <Painel titulo="Como os cálculos funcionam">
        <dl className="definicoes">
          <div>
            <dt>Retenção</dt>
            <dd>valor da medição × percentual de retenção do contrato</dd>
          </div>
          <div>
            <dt>Base do rendimento</dt>
            <dd>somente retenções com depósito simulado confirmado e ainda não liberadas</dd>
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
            <dd>principal retido + rendimentos acumulados da contratada</dd>
          </div>
        </dl>

        <div className="nota" style={{ marginTop: 14 }}>
          Parâmetros atuais desta demonstração: mensalidade de{' '}
          {formatarMoeda(config.mensalidadeCents)} por contratante, participação de{' '}
          {formatarPercentual(config.participacaoPercentual)} sobre o rendimento bruto e taxa mensal
          hipotética de {formatarPercentual(config.taxaMensalPercentual)}. Sem capitalização, sem
          tributos e sem outros custos. Um clique em “Simular próximo mês” gera um único lançamento por
          período, e não há rendimento depois da liberação do contrato.
        </div>
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
              ao estado inicial. Esta ação não pode ser desfeita.
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
