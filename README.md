# TrustRetain — Gestão de Retenções Contratuais (MVP de demonstração)

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
4. Pronto. A cada envio para a `main`, a publicação roda sozinha. Para rodar na hora,
   vá na aba **Actions**, abra "Publicar demonstração" e clique em **Run workflow**.
5. Ao terminar, o endereço aparece na própria execução e em **Settings → Pages**.
   Ele tem o formato `https://<seu-usuario>.github.io/reten-mvp/`.

Esse é o link que você compartilha com o grupo.

**Sobre o caminho base.** No GitHub Pages de um repositório de projeto, a aplicação fica em
uma subpasta (`/reten-mvp/`) em vez da raiz do domínio. O projeto lida com isso usando
caminhos relativos (`base: './'` no `vite.config.ts`) em vez de fixar `/reten-mvp/`:
funciona igual na subpasta do Pages, na raiz do Netlify e se o repositório for renomeado.
As rotas usam `#` pelo mesmo motivo — nenhuma configuração de servidor é necessária.

Para conferir você mesmo, servindo o build exatamente como o Pages faz:

```bash
npm run build
node scripts/servir-subpasta.mjs   # abre em http://localhost:4199/reten-mvp/
```

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
- Confirmação de recebimento, aprovação e recusa de documentos (a recusa exige motivo e fica
  registrada com data e responsável), aceite da entrega, registro e resolução de disputa,
  e confirmação da liberação.
- **Importação de cauções do ERP (CSV)**, com arquivo de exemplo e prévia linha a linha.

### Contratada
- Seleção de qual empresa contratada de exemplo está sendo visualizada.
- Painel com principal retido, rendimentos destinados a ela, saldo total retido,
  valores já liberados e pendências.
- Tela inicial pelas pendências: cada item traz responsável, motivo e prazo.
- Extrato por contrato, checklist de condições, envio e reenvio simulado de documentos (com
  histórico de versões), solicitação de liberação e acompanhamento do status.

### Plataforma
- Painel com contratantes cadastradas, contratos administrados, total de recursos retidos,
  receita mensal projetada de assinaturas e receita acumulada de participação nos rendimentos
  (indicadores mantidos separados, sem somar períodos diferentes).
- **Planos**: Essencial (até 15 contratos com retenção ativa, R$ 2.500/mês), Profissional (até 50,
  R$ 5.000/mês) e Corporativo (acima de 50, a partir de R$ 10.000/mês). Implantação única de
  R$ 10.000 a R$ 30.000, apresentada separadamente. Fornecedores convidados não pagam nada.
  O plano de cada contratante é ajustável na tela, e a receita mensal projetada acompanha.
- **Data da simulação**: seletor da data de referência usada em toda a aplicação, com atalhos para
  a véspera e para o dia do prazo do contrato de teste padrão, e botão para abrir e fechar uma
  disputa nesse contrato.
- Parâmetros da simulação: participação da plataforma e taxa mensal hipotética — hipóteses de
  demonstração que só valem para contratos com módulo financeiro ativo.

### Módulo financeiro (opcional, por contrato)

Cada contrato é marcado como **com** ou **sem** módulo financeiro.

| | Sem o módulo | Com o módulo |
| --- | --- | --- |
| Saldo retido | soma das retenções das medições | só as retenções com depósito confirmado |
| Etapa de depósito | não existe | obrigatória para render e liberar |
| Rendimento mensal | não há | taxa hipotética sobre o principal depositado |
| Participação da plataforma | não há | 10% do rendimento bruto |
| Telas | sem aba de extrato, sem coluna de depósito | extrato financeiro completo |

A demonstração traz contratos dos dois tipos. Rendimento, depósito e participação simplesmente
não aparecem nos contratos sem o módulo.

### Dados e persistência
- A demonstração vem com 2 contratantes, 3 contratadas e 6 contratos em situações variadas,
  incluindo o **contrato de teste padrão** descrito abaixo.
- **A data de referência é fixa (30/07/2026), não o relógio do computador.** Todo mundo do grupo
  abre exatamente o mesmo cenário, e o relógio pode ser movido no perfil Plataforma.
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

Exemplo de referência (contrato CT-2024-001 da demonstração, com módulo financeiro ativo):

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
- A mensalidade do plano é cobrada à parte e **não reduz** o saldo da contratada.
- Contratos **sem módulo financeiro** não rendem nada e não geram participação.

### Condições para liberar (todas obrigatórias)

1. Todos os documentos obrigatórios aprovados.
2. Entrega aceita pela contratante.
3. Prazo contratual cumprido (data mínima de liberação atingida).
4. Nenhuma disputa em aberto.
5. Saldo positivo.
6. *Somente com módulo financeiro:* todas as medições com depósito confirmado.

Cada uma delas, sozinha, bloqueia a solicitação de liberação.

### Contrato de teste padrão (CT-2026-100)

| Campo | Valor |
| --- | --- |
| Valor total e medido | R$ 100.000,00 |
| Retenção | 5% → R$ 5.000,00 de principal |
| Conclusão e aceite | 01/06/2026 |
| Prazo | 60 dias corridos, contados do dia seguinte à conclusão |
| Data mínima de liberação | 31/07/2026 |
| Módulo financeiro | desativado |

Com a data da simulação em **30/07/2026** o contrato fica bloqueado; em **31/07/2026** fica
elegível. Os atalhos estão em Plataforma → Data da simulação.

### Importar cauções do ERP (CSV)

Contratante → "Importar cauções do ERP (CSV)". O arquivo precisa das colunas `contrato`,
`fornecedor`, `valor medido`, `percentual`, `valor retido` e `vencimento`. Aceita ponto e vírgula
ou vírgula como separador, valores no formato brasileiro e datas em dia/mês/ano.

A tela já vem com o exemplo preenchido (e há botão para baixá-lo). Cada linha vira um contrato com
uma medição registrada; fornecedores novos são cadastrados como contratadas convidadas. A prévia
confere linha a linha se o valor retido bate com o percentual, se o percentual está entre 0 e 100,
se a data é válida e se o código já existe — e explica o motivo de cada linha descartada.

Estados do documento: pendente → enviado → aprovado ou rejeitado (com reenvio).
Estados da liberação: bloqueada por pendências → elegível para solicitação → solicitada → liberada.

A contratada solicita e a contratante confirma. As condições são **revalidadas no momento da
confirmação**. Só existe liberação **integral** nesta versão; liberação parcial ficou fora do escopo.
Após liberar, o saldo retido é zerado, o extrato é preservado, e o contrato não aceita liberação
duplicada nem novas movimentações.

---

## 5. Roteiro de demonstração (5 minutos)

A demonstração abre em **30/07/2026**, a véspera do prazo do contrato de teste padrão.

**0:00 — Contexto (30 s).** Perfil **Contratante**. Aponte a faixa amarela (ambiente de
demonstração, valores fictícios) e a data da simulação no topo. No painel: contratos, saldo retido
e pendências priorizadas.

**0:30 — A trava de prazo (60 s).** Abra **CT-2026-100 — Contrato de teste padrão**.
R$ 100.000,00 medidos, 5% de retenção, R$ 5.000,00 retidos. Conclusão em 01/06/2026, 60 dias
corridos, prazo em 31/07/2026. O checklist mostra quatro travas cumpridas e uma pendente: o prazo.
Vá em **Plataforma → Data da simulação** e clique em **31/07/2026 — prazo cumprido**: o contrato
vira **Elegível**. Volte para 30/07/2026 e ele bloqueia de novo.

**1:30 — As outras travas (45 s).** Na mesma tela, clique em **Abrir disputa neste contrato**:
agora são duas travas pendentes. Feche a disputa e volte a uma. É a mensagem central: qualquer
condição, sozinha, segura o dinheiro — e a plataforma diz exatamente qual.

**2:15 — Os documentos (60 s).** Perfil **Contratada**, empresa Vertax Engenharia. A tela abre
pelas pendências, cada uma com **responsável, motivo e prazo**. Abra o contrato com a ART recusada:
o motivo, a data e quem recusou estão visíveis, e o histórico de versões guarda cada remessa.
Clique em **Reenviar documento** — nasce a versão 2. Como contratante, **Confirmar recebimento** e
depois **Aprovar**.

**3:15 — O módulo financeiro (45 s).** Abra **CT-2024-001**, que tem o módulo ativo: aba **Extrato
financeiro** → **Simular próximo mês**. R$ 40,00 de rendimento bruto, R$ 4,00 para a plataforma,
R$ 36,00 para a contratada, saldo de R$ 5.036,00. Volte ao CT-2026-100 e mostre que ali não há
extrato, nem depósito, nem participação: o módulo é opcional e quem não contrata não paga por ele.

**4:00 — O negócio (45 s).** Perfil **Plataforma → Planos**. Três faixas por volume, implantação
única separada e fornecedores convidados sem custo. Mostre que a receita mensal projetada acompanha
o plano de cada contratante. Se sobrar tempo, **Importar cauções do ERP (CSV)**: o exemplo já vem
preenchido e a prévia aponta linha a linha o que não fecha.

**4:45 — Fechamento (15 s).** Fora do escopo: integração bancária, banco de dados compartilhado,
autenticação e liberação parcial. Use **Restaurar demonstração** para zerar antes da próxima
apresentação.

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
    planos.ts        planos comerciais e implantação
    atores.ts        responsáveis fictícios que assinam as ações
    csv.ts           leitura do CSV de cauções do ERP
  app/             estado da aplicação, persistência e rotas
  components/      componentes visuais reutilizáveis
  views/           telas de cada perfil
tests/             testes das regras de cálculo e de liberação
scripts/           testes, teste de ponta a ponta no navegador e servidor de subpasta
```

As regras de cálculo e de elegibilidade ficam separadas dos componentes visuais de propósito:
é o que permite testá-las sem abrir o navegador.

---

## 7. Testes

```bash
npm test          # 35 testes das regras, travas, documentos, planos e importação
npm run build     # verificação de tipos + build de produção
```

Os dois rodam automaticamente em cada pull request (`.github/workflows/verificar.yml`)
e antes de cada publicação.

Há também um teste de ponta a ponta que percorre o fluxo inteiro em um navegador real
(80 verificações). Ele precisa do Playwright, que não faz parte das dependências do projeto:

```bash
npm install -D playwright && npx playwright install chromium
npm run build && npm run preview &     # servidor local na porta 4173
npm run test:navegador
```
