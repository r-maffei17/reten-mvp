# Reten — Gestão de Retenções Contratuais (MVP de demonstração)

Protótipo navegável para apresentação na disciplina de Empreendedorismo.
Aplicação web em português do Brasil, com valores em reais e datas no formato brasileiro.

> **Demonstração — dados e movimentações fictícios.**
> Depósitos, aplicações, rendimentos, cobranças e liberações são **simulados**.
> Não há integração com bancos, meios de pagamento ou produtos de investimento.
> A plataforma não promete rentabilidade, não retira passivos do balanço e não elimina disputas contratuais.

---

## 1. Como abrir no seu computador

Você precisa do [Node.js](https://nodejs.org) versão 20 ou mais nova (instale a versão "LTS").

Abra o terminal na pasta do projeto e rode, **uma vez**:

```bash
npm install
```

Depois, sempre que quiser abrir a aplicação:

```bash
npm run dev
```

O terminal mostra um endereço parecido com `http://localhost:5173`. Abra esse endereço no navegador.
Para encerrar, aperte `Ctrl + C` no terminal.

### Gerar a versão de produção

```bash
npm run build     # gera a pasta dist/ com os arquivos prontos para publicar
npm run preview   # abre a versão de produção localmente para conferir
```

---

## 2. Como publicar e obter um link para o grupo

### Opção A — GitHub Pages (recomendada, já configurada)

O repositório já tem a automação pronta em `.github/workflows/publicar.yml`.
Falta apenas **um clique seu**, porque essa configuração exige a sua conta:

1. Abra o repositório no GitHub.
2. Vá em **Settings** (Configurações) → **Pages**, no menu da esquerda.
3. Em **Build and deployment** → **Source**, escolha **GitHub Actions**.
4. Pronto. Vá na aba **Actions**, abra o fluxo "Publicar demonstração" e clique em **Run workflow**
   (ou apenas faça um novo envio de código; ele roda sozinho).
5. Ao terminar, o endereço aparece na própria execução e em **Settings → Pages**.
   Ele tem o formato `https://<seu-usuario>.github.io/reten-mvp/`.

Esse é o link que você compartilha com o grupo.

### Opção B — Netlify ou Vercel, arrastando a pasta

Se preferir não mexer no GitHub:

1. Rode `npm run build` no seu computador. Isso cria a pasta `dist`.
2. Entre em [app.netlify.com/drop](https://app.netlify.com/drop).
3. Arraste a pasta `dist` para a área indicada na página.
4. O Netlify devolve um endereço público na hora. Crie uma conta gratuita se quiser mantê-lo.

A aplicação usa rotas com `#` justamente para funcionar em qualquer hospedagem de arquivos
estáticos, sem precisar de configuração de servidor.

---

## 3. O que dá para fazer na demonstração

Não há login. Use o seletor no topo para alternar entre **Contratante**, **Contratada** e **Plataforma**.
O seletor serve à apresentação e **não representa autenticação ou controle real de acesso**.

### Contratante
- Painel com contratos ativos, saldo principal retido, documentos aguardando análise,
  contratos elegíveis para liberação e a lista de pendências prioritárias.
- Lista de contratos com busca e filtro por situação.
- Cadastro de contrato (nome, código, partes, valor, percentual de retenção, datas e condições).
- Registro de medição com cálculo automático da retenção e confirmação do depósito simulado.
- Aprovação e rejeição de documentos (rejeição exige justificativa), aceite da entrega,
  registro e resolução de disputa, e confirmação da liberação.

### Contratada
- Seleção de qual empresa contratada de exemplo está sendo visualizada.
- Painel com principal retido, rendimentos destinados a ela, saldo total retido,
  valores já liberados e pendências.
- Extrato por contrato, checklist de condições, envio e reenvio simulado de documentos,
  solicitação de liberação e acompanhamento do status.

### Plataforma
- Painel com contratantes cadastradas, contratos administrados, total de recursos retidos,
  receita mensal projetada de assinaturas e receita acumulada de participação nos rendimentos
  (indicadores mantidos separados, sem somar períodos diferentes).
- Parâmetros da simulação: mensalidade por contratante, participação da plataforma e taxa mensal
  hipotética — todos identificados como hipóteses de demonstração.

### Dados e persistência
- A demonstração já vem com 2 contratantes, 3 contratadas e 5 contratos em situações variadas.
- As alterações ficam salvas no `localStorage` do navegador e sobrevivem a recarregar a página.
- **Cada navegador tem a sua própria demonstração.** O que uma pessoa do grupo alterar não aparece
  para as outras. Banco de dados compartilhado e autenticação ficaram fora desta primeira versão.
- "Restaurar demonstração" (no rodapé do menu ou na página "Sobre") devolve os dados iniciais,
  com confirmação antes.

---

## 4. Regras da simulação

Todos os valores monetários são armazenados em **centavos** (números inteiros), para não haver
erro de arredondamento.

| Cálculo | Fórmula |
| --- | --- |
| Retenção | valor da medição × percentual de retenção do contrato |
| Base do rendimento | somente retenções com depósito simulado confirmado e ainda não liberadas |
| Rendimento bruto | principal elegível × taxa mensal hipotética |
| Receita da plataforma | rendimento bruto × participação da plataforma |
| Rendimento da contratada | rendimento bruto − receita da plataforma |
| Saldo para liberação | principal retido + rendimentos acumulados da contratada |

Exemplo de referência (é o contrato CT-2024-001 da demonstração):

- Principal: R$ 5.000,00
- Taxa mensal hipotética: 0,8% → rendimento bruto de R$ 40,00
- Participação da plataforma: 10% → R$ 4,00
- Rendimento da contratada: R$ 36,00
- Saldo para liberação: R$ 5.036,00

Outras regras:

- **Sem capitalização:** a taxa incide sempre sobre o principal depositado, não sobre os rendimentos.
- Cada clique em "Simular próximo mês" gera **um único lançamento por período**, avançando um mês.
- Não há rendimento depois da liberação do contrato.
- Alterar as taxas afeta **apenas simulações futuras**; os lançamentos anteriores preservam a taxa
  aplicada na época.
- A simulação desconsidera tributos e outros custos.
- A mensalidade da plataforma é cobrada à parte e **não reduz** o saldo da contratada.

### Condições para liberar (todas obrigatórias)

1. Todas as medições cadastradas com depósito simulado confirmado.
2. Todos os documentos obrigatórios aprovados.
3. Entrega aceita pela contratante.
4. Data mínima de liberação atingida.
5. Nenhuma disputa em aberto.
6. Saldo positivo.

Estados do documento: pendente → enviado → aprovado ou rejeitado (com reenvio).
Estados da liberação: bloqueada por pendências → elegível para solicitação → solicitada → liberada.

A contratada solicita e a contratante confirma. As condições são **revalidadas no momento da
confirmação**. Só existe liberação **integral** nesta versão; liberação parcial ficou fora do escopo.
Após liberar, o saldo retido é zerado, o extrato é preservado, e o contrato não aceita liberação
duplicada nem novas movimentações.

---

## 5. Roteiro de demonstração (5 minutos)

**0:00 — Contexto (30 s).** Perfil **Contratante**. Aponte a faixa amarela: ambiente de demonstração,
valores fictícios. No painel: 5 contratos, R$ 250.500,00 de principal retido, pendências priorizadas.

**0:30 — O contrato (45 s).** Abra **CT-2024-001 — Subestação Norte 138 kV**. Contrato de R$ 1.000.000,00
com 5% de retenção. Aba **Medições e retenções**: medição de R$ 100.000,00 → R$ 5.000,00 retidos,
R$ 95.000,00 pagos. Depósito simulado já confirmado.

**1:15 — O rendimento (45 s).** Aba **Extrato financeiro** → **Simular próximo mês**.
Aparece: bruto R$ 40,00, R$ 4,00 para a plataforma, R$ 36,00 para a contratada.
Saldo para liberação: **R$ 5.036,00**. Diga que é sem capitalização, sem tributos, e que a
mensalidade é separada.

**2:00 — O bloqueio (60 s).** Volte à lista e abra **CT-2025-031 — Terraplenagem Trecho 4**.
O checklist mostra exatamente o que falta: disputa em aberto. Clique em **Resolver disputa**,
escreva o desfecho e veja o contrato virar **Elegível para solicitação**.
(Alternativa: **CT-2025-022**, com documento rejeitado e justificativa visível.)

**3:00 — Os dois lados (60 s).** Troque para o perfil **Contratada** (Andrade Montagens).
Mostre principal retido, rendimentos que são dela e as pendências. Abra o CT-2024-001 e clique em
**Solicitar liberação**. Volte para **Contratante** e clique em **Confirmar liberação simulada**.
O saldo zera, o extrato permanece e o botão de liberar some — sem liberação duplicada.

**4:00 — O negócio (45 s).** Perfil **Plataforma**. Duas fontes de receita, apresentadas separadamente:
assinatura (R$ 998,00 por mês, 2 contratantes × R$ 499,00) e participação nos rendimentos
(acumulado). Em **Parâmetros da simulação**, mostre que são hipóteses ajustáveis, não taxas reais.

**4:45 — Fechamento (15 s).** O que fica fora desta versão: integração bancária, banco de dados
compartilhado, autenticação e liberação parcial. Use **Restaurar demonstração** para deixar tudo
pronto para a próxima apresentação.

---

## 6. Organização do código

```
src/
  domain/          regras puras, sem interface (é onde vive o "motor" do produto)
    types.ts         modelo de dados
    money.ts         conversão e formatação de valores em centavos
    datas.ts         datas e períodos no padrão brasileiro
    calculos.ts      retenção, rendimento e resumo financeiro do contrato
    elegibilidade.ts condições para liberar a retenção
    validacoes.ts    validação dos formulários
    acoes.ts         transições de estado (registrar, aprovar, liberar...)
    selecoes.ts      consultas derivadas usadas pelas telas
    dadosIniciais.ts dados fictícios da demonstração
  app/             estado da aplicação, persistência e rotas
  components/      componentes visuais reutilizáveis
  views/           telas de cada perfil
tests/             testes das regras de cálculo e de liberação
scripts/           execução dos testes e teste de ponta a ponta no navegador
```

As regras de cálculo e de elegibilidade ficam separadas dos componentes visuais de propósito:
é o que permite testá-las sem abrir o navegador.

---

## 7. Testes

```bash
npm test          # 22 testes das regras de cálculo, elegibilidade e liberação
npm run build     # verificação de tipos + build de produção
```

Há também um teste de ponta a ponta que percorre o fluxo inteiro em um navegador real
(48 verificações). Ele precisa do Playwright, que não faz parte das dependências do projeto:

```bash
npm install -D playwright && npx playwright install chromium
npm run build && npm run preview &     # servidor local na porta 4173
npm run test:navegador
```
