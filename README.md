# ZEUS Finance

Aplicação full stack de finanças pessoais para acompanhar receitas, gastos, dívidas e metas em um único painel.

## Estado atual

Versão em evolução para **ZEUS 1.1**.

Funcionalidades principais:

- Cadastro, login e logout com sessão por cookie.
- Troca de senha exigindo a senha atual, com encerramento automático das outras sessões.
- Cadastro, edição, listagem e exclusão de gastos, dívidas, metas e receitas.
- Salários recorrentes com período de vigência e status ativo/inativo.
- Rendas extras por data de recebimento.
- Gastos com data financeira própria, independente da data de cadastro.
- Dashboard com receita mensal, salário, extras, gastos, saldo estimado, dívida total e metas.
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
6. proteção para impedir valor reservado de meta acima do valor alvo.

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
- criação, atualização, listagem, remoção e isolamento de orçamentos mensais.

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

`React -> ApiClient -> FinanceApi -> FinanceRepository -> SqliteDatabase -> SQLite`

Responsabilidades:

- **ApiClient:** chamadas HTTP da interface.
- **FinanceApi:** autenticação, roteamento, validação de origem e respostas HTTP.
- **FinanceRepository:** regras de persistência de registros e receitas.
- **AuthService:** cadastro, login, troca de senha, sessões e proteção contra tentativas excessivas.
- **SqliteDatabase:** conexão SQLite, queries e migrations.

Valores financeiros são armazenados em centavos inteiros.
O fuso das datas financeiras usa `APP_TIMEZONE`, com `America/Sao_Paulo` como padrão.

## Beta gratuito na nuvem

O projeto já possui preparação para **Render Free + Supabase Free**.

- Em desenvolvimento local, continua usando SQLite.
- Em produção, quando `DATABASE_URL` estiver definida, usa PostgreSQL.
- `npm start` escolhe automaticamente o servidor local ou de produção com base em `NODE_ENV`.
- O arquivo `render.yaml` contém o Blueprint do Render.
- O passo a passo está em [CLOUD_BETA.md](./CLOUD_BETA.md).

## Próximos passos planejados

Prioridades seguintes:

- movimentações de metas;
- gastos recorrentes;
- categorias personalizadas;
- exportação CSV/PDF;
- backup e restauração;
- PWA e deploy HTTPS.

## Autor

Gabriel Silva — GBLSLVA
