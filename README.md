# ZEUS Finance

Aplicação full stack de finanças pessoais para acompanhar receitas, gastos, dívidas e metas em um único painel.

## Estado atual

Versão em evolução para **ZEUS 1.1**.

Funcionalidades principais:

- Cadastro, login e logout com sessão por cookie.
- Sessão padrão de 24 horas, com opção explícita de manter o dispositivo conectado por 30 dias.
- Troca de senha exigindo a senha atual, com encerramento automático das outras sessões.
- Exclusão segura da conta, com confirmação por senha e remoção transacional dos dados do usuário.
- Exportação completa dos dados da conta em backup JSON isolado por usuário.
- Cadastro, edição, listagem e exclusão de gastos, dívidas, metas e receitas.
- Salários recorrentes com período de vigência e status ativo/inativo.
- Gastos recorrentes com categoria, valor mensal, dia de vencimento, vigência e status ativo/inativo.
- Registro de pagamento mensal da recorrência, convertendo o compromisso pendente em gasto real sem dupla contagem.
- Rendas extras por data de recebimento.
- Gastos com data financeira própria, independente da data de cadastro.
- Dashboard com receita mensal, salário, extras, gastos, saldo estimado, dívida total e metas.
- Cálculos oficiais do dashboard centralizados no backend, incluindo histórico de 6 meses e regras de vigência de receitas.
- ZEUS Insights com análises automáticas de saldo, comparação mensal, categoria dominante, orçamento, dívidas e metas.
- Resumo financeiro mensal automático com saldo, comparação, principal categoria e pontos de atenção.
- Assistente "Pergunte ao ZEUS" para responder perguntas sobre saldo, gastos, receitas, categorias, orçamento, dívidas, metas e comparação mensal.
- Detecção de possíveis lançamentos duplicados, gastos individuais fora do padrão e categorias com alta anormal.
- Dívidas estruturadas com credor, valor original, saldo atual, juros, parcelas, vencimento e status.
- Pagamentos parciais de dívidas com histórico, baixa automática do saldo e atualização das parcelas pagas.
- Pagamentos e edições de dívidas protegidos por transações de banco para evitar inconsistências em operações simultâneas.
- Distribuição de gastos por categoria.
- Orçamento mensal por categoria, com limite, gasto, restante e percentual utilizado.
- Navegação entre meses no dashboard e na área de orçamentos.
- Histórico comparativo dos últimos 6 meses com receitas, gastos e saldo.
- Isolamento dos dados por usuário autenticado.
- Banco SQLite local com migrations versionadas.
- Interface responsiva para desktop e celular.
- CI com testes de API, migrations e build.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React 18, TypeScript, TSX |
| Visual | HTML5, CSS3, Grid, Flexbox, media queries |
| Servidor | Node.js 24, ES Modules, node:http |
| Banco | SQLite, SQL, node:sqlite |
| Segurança | scrypt, SHA-256, cookies HttpOnly/SameSite |
| Build | Vite, Rollup |
| Testes | node:test, node:assert/strict |
| CI | GitHub Actions |

## Regras financeiras atuais

- **Salário:** receita recorrente mensal durante o período entre `active_from` e `active_until`, desde que esteja ativa.
- **Renda extra:** considerada apenas no mês da data de recebimento.
- **Gastos:** considerados pelo campo de data financeira do lançamento.
- **Saldo mensal:** receitas do mês menos gastos do mês.
- **Dívida total:** soma do saldo atual das dívidas estruturadas.
- **Pagamento de dívida:** reduz o saldo atual e pode contar como parcela paga; excluir um pagamento recalcula saldo e parcelas.
- **Status da dívida:** muda automaticamente para `paid` quando o saldo chega a zero.
- **Metas:** progresso calculado pelo valor reservado em relação ao valor alvo.
- **Orçamento mensal:** cada categoria pode ter um limite independente para cada mês.
- **Uso do orçamento:** calculado apenas sobre categorias que possuem limite definido, evitando comparar orçamento parcial com gastos sem limite.
- **Histórico mensal:** receitas e gastos são recalculados pela data financeira de cada lançamento e pela vigência histórica dos salários.
- **Projeção recorrente:** compromissos mensais ficam separados dos gastos já realizados e alimentam o saldo projetado sem falsificar o histórico pago. Ao marcar uma recorrência como paga, ela vira um gasto real daquele mês e deixa de compor o valor pendente.

## Banco e migrations

O banco é criado automaticamente em:

`data/zeus.sqlite`

O sistema mantém a tabela `schema_migrations` e aplica alterações de estrutura de forma incremental.

Migrações atuais:

1. esquema inicial;
2. datas financeiras e auditoria básica em lançamentos;
3. recorrência, vigência e status de receitas;
4. dívidas estruturadas e histórico de pagamentos, com migração automática das dívidas antigas;
5. orçamentos mensais por categoria;
6. proteção para impedir valor reservado de meta acima do valor alvo;
7. gastos recorrentes com vigência e vencimento mensal.

Bases criadas por versões anteriores são atualizadas automaticamente ao iniciar o servidor.

## Executar

Requisitos:

- Node.js 24 ou superior;
- npm;
- Git, se for atualizar pelo repositório.

Instale as dependências:

`npm install`

Inicie interface e API no mesmo processo:

`npm start`

No computador:

`http://localhost:5173`

## Acesso pelo celular

1. Conecte computador e celular à mesma rede Wi-Fi.
2. Execute `iniciar-zeus-mobile.bat` ou `npm start`.
3. O terminal exibirá um endereço semelhante a:

`http://192.168.0.10:5173`

4. Abra esse endereço no navegador do celular.

O launcher Windows libera somente a porta TCP 5173 no perfil de rede privada.

## Desenvolvimento separado

Frontend Vite:

`npm run dev`

API:

`npm run server`

O Vite encaminha `/api` para a API local.

## Testes

Execute:

`npm test`

A suíte cobre atualmente:

- autenticação;
- isolamento de usuários;
- criação, edição e exclusão de registros;
- validação de valores e datas;
- receitas recorrentes e extras;
- persistência;
- proteção de origem;
- migração de uma base antiga sem perda dos registros principais;
- criação, atualização, listagem, remoção e isolamento de orçamentos mensais;
- cálculo oficial do dashboard e isolamento do resumo financeiro entre usuários;
- geração de insights financeiros e isolamento dos insights entre usuários;
- detecção de duplicidade e anomalias com base no histórico financeiro do próprio usuário.

## Build

`npm run build`

## CI/CD

O workflow em `.github/workflows/ci.yml` executa em pushes e pull requests para `main`:

1. checkout;
2. Node.js 24;
3. `npm ci`;
4. `npm test`;
5. `npm run build`;
6. upload do diretório `dist/`.

## Arquitetura atual

Fluxo principal:

`React -> ApiClient -> FinanceApi -> Services/Repositories -> DatabaseAdapter -> SQLite/PostgreSQL`

Responsabilidades:

- **ApiClient:** chamadas HTTP da interface.
- **FinanceApi:** roteamento, validação de origem e respostas HTTP.
- **FinanceRepository:** fachada compatível da camada financeira; delega persistência aos repositories e cálculos/orquestração aos services.
- **UserRepository:** persistência de usuários, credenciais e sessões.
- **EntryRepository:** persistência e validação de gastos e metas.
- **DebtRepository:** dívidas, pagamentos, recálculo de saldo e concorrência transacional.
- **IncomeRepository:** persistência e validação de receitas recorrentes e extras.
- **BudgetRepository:** persistência e validação de orçamentos mensais por categoria.
- **RecurringExpenseRepository:** recorrências, vigência, pagamentos mensais e proteção contra duplicidade.
- **DashboardService:** consolida receitas, gastos, recorrências, dívidas, metas, orçamento e histórico mensal.
- **InsightService:** tendências, anomalias, alertas e resumo financeiro.
- **AssistantService:** interpreta perguntas suportadas e combina Dashboard/Insights para responder com dados reais.
- **ExportService:** gera o backup financeiro completo da conta.
- **AuthService:** regras de cadastro, login, troca de senha, sessões e proteção contra tentativas excessivas; não executa SQL diretamente.
- **DatabaseAdapter:** contrato comum da camada de persistência.
- **SqliteDatabase / PostgresDatabase:** implementações polimórficas do contrato de banco.
- **src/domain/finance.ts:** tipos e constantes do domínio financeiro usados pelo frontend.
- **src/utils/finance.ts:** formatação e utilitários de datas/percentuais.
- **server/domain/finance-values.mjs:** validações e normalizadores compartilhados do domínio financeiro.
- **src/components:** componentes visuais reutilizáveis do React.
- **src/features:** módulos de interface por funcionalidade; Assistente, Insights e Recorrências já foram extraídos do App principal.

O projeto usa POO principalmente no backend/domínio e composição funcional no React. Herança é usada apenas onde existe relação de subtipo clara; composição e injeção de dependências são preferidas para evitar acoplamento.

Valores financeiros são armazenados em centavos inteiros.
O fuso das datas financeiras usa `APP_TIMEZONE`, com `America/Sao_Paulo` como padrão.

## Princípios de arquitetura

A evolução do ZEUS segue estes critérios:

- responsabilidade única: autenticação, persistência, regras agregadas, HTTP e interface devem permanecer separados;
- encapsulamento: services não acessam detalhes internos de outro componente;
- abstração: regras dependem de contratos estáveis, não de PostgreSQL/SQLite diretamente;
- polimorfismo: adaptadores de banco podem ser substituídos mantendo a mesma interface;
- composição sobre herança: classes são combinadas por dependências explícitas;
- React funcional: componentes React não são convertidos em classes apenas para “usar POO”;
- organização por feature: páginas/painéis complexos vivem em módulos próprios e recebem estado/callbacks explicitamente por props;
- refatorações estruturais só entram na `main` depois de testes de API, build, smoke e PostgreSQL.

## Beta gratuito na nuvem

O projeto já possui preparação para **Render Free + Supabase Free**.

- Em desenvolvimento local, continua usando SQLite.
- Em produção, quando `DATABASE_URL` estiver definida, usa PostgreSQL.
- `npm start` escolhe automaticamente o servidor local ou de produção com base em `NODE_ENV`.
- O arquivo `render.yaml` contém o Blueprint do Render.
- O passo a passo está em [CLOUD_BETA.md](./CLOUD_BETA.md).

## Próximos passos planejados

Prioridades seguintes:

- tendências por categoria e detecção de anomalias;
- resumo financeiro semanal e mensal;
- ampliar o assistente conversacional com histórico de perguntas e linguagem natural mais flexível;
- movimentações de metas;
- categorias personalizadas;
- exportação CSV/PDF;
- restauração de backup JSON;
- PWA e deploy HTTPS.

## Autor

Gabriel Silva — GBLSLVA
