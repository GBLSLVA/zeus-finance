# ZEUS Finance

**Do registro de gastos ao acompanhamento de metas: uma aplicação full stack de finanças pessoais.**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-persist%C3%AAncia-003B57?logo=sqlite&logoColor=white)

Projeto de portfólio de [Gabriel Silva](https://github.com/GBLSLVA), com interface responsiva, API HTTP orientada a objetos e persistência no servidor. **Versão atual: MVP executável localmente.**

## Funcionalidades implementadas

- Cadastro, login e logout com sessão por cookie.
- Cadastro, listagem e exclusão de gastos, dívidas e metas.
- Separação dos registros por usuário autenticado.
- Painel calculado a partir dos registros, com distribuição de gastos por categoria.
- Banco SQLite criado automaticamente, sem instalar um servidor de banco.
- Prévia da interface e API com um único comando.

## Tecnologias e ferramentas utilizadas

| Camada | Tecnologias | Aplicação |
| --- | --- | --- |
| Interface | React 18, React DOM, TypeScript, TSX | Componentes, formulários e tipagem estrita |
| Visual | HTML5, CSS3, Grid, Flexbox, media queries | Layout responsivo e tema visual |
| Servidor | Node.js 24, JavaScript ES Modules, node:http | API HTTP e serviços orientados a objetos |
| Banco | SQLite, SQL, node:sqlite | Persistência, restrições e consultas parametrizadas |
| Autenticação | node:crypto, scrypt, SHA-256, cookies HttpOnly/SameSite | Hash de senhas e tokens de sessão |
| Desenvolvimento | Vite, plugin React, npm, package-lock.json | Servidor de desenvolvimento e dependências |
| Prévia local | Rollup, plugins CommonJS/Node Resolve, compilador TypeScript | Compilação no processo Node |
| Testes | node:test, node:assert/strict | Integração HTTP com banco temporário real |
| Ferramentas de trabalho | VS Code, Git, GitHub | Edição, histórico e documentação |

O backend usa JavaScript com classes; o frontend usa TypeScript. O projeto não depende de Express, ORM ou serviços pagos.

## Executar

Na pasta do projeto, execute `npm install` e depois `npm start`. Abra http://localhost:5173 e crie uma conta com senha de pelo menos 12 caracteres. O comando inicia interface e API juntos; mantenha o terminal aberto.

A prévia usa Rollup e o compilador TypeScript no próprio processo Node, para funcionar neste ambiente Windows em que o processo auxiliar do Vite falha com `spawn EPERM`. Após editar a interface, reinicie `npm start` para recompilar. Essa prévia é local, sem hot reload e sem otimização de produção.

Para desenvolvimento com hot reload em um ambiente que suporte Vite: execute `npm run server` e `npm run dev` em terminais separados, com a prévia anterior encerrada.

O banco é criado automaticamente em `data/zeus.sqlite`. Não publique essa pasta. Os dados ficam no servidor, separados por conta; não são mais gravados no localStorage. Os dados do protótipo antigo não são importados automaticamente.

## Decisões de arquitetura

- `SqliteDatabase`: conexão, criação inicial do esquema e execução de consultas parametrizadas.
- `FinanceRepository`: persistência de gastos, dívidas e metas; todas as consultas financeiras exigem o identificador do usuário autenticado.
- `AuthService`: cadastro, hash scrypt com sal aleatório, sessões com expiração de 24 horas e limite de tentativas por endereço.
- `FinanceApi`: validação das requisições, rotas HTTP e cookies HttpOnly/SameSite. Em produção, o cookie exige HTTPS.
- `ApiClient`: comunicação da interface com a API. Componentes React cuidam da apresentação.
- Valores são armazenados em centavos inteiros. O painel usa registros reais e calcula o mês em UTC, indicado na interface.
- O SQLite simplifica o uso local. Esta primeira versão usa operações de banco e hash síncronas; alta concorrência exigirá revisão dessa escolha.

## Rotas

POST `/api/register`, `/api/login`, `/api/logout`; GET `/api/me`.
GET e POST `/api/transactions`, `/api/debts`, `/api/goals`.
DELETE `/api/{transactions|debts|goals}/:id`.

## Verificar

`npm test` testa a API com SQLite real temporário: login, isolamento entre contas, valores inválidos, persistência, exclusão e logout.
`npm run build` verifica TypeScript e gera a interface em `dist`.

## Limites atuais

Execução local: o site publicado anteriormente ainda não usa esta API. Para acesso remoto e sincronização entre dispositivos, é necessário hospedar frontend e API na mesma origem com HTTPS e disco persistente, além de backups. Ainda não há recuperação de senha, edição de registros, cadastro de receitas ou cálculo de juros/vencimentos. A listagem de dívidas representa os saldos informados, sem recomendar estratégias financeiras.
