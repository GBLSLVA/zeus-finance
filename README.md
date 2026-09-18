# ZEUS Finance

**Do registro de gastos ao acompanhamento de metas: uma aplicação full stack de finanças pessoais.**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-persist%C3%AAncia-003B57?logo=sqlite&logoColor=white)

Projeto de portfólio de [Gabriel Silva](https://github.com/GBLSLVA), Tecnólogo em Análise e Desenvolvimento de Sistemas pela UNIP, com interface responsiva, API Node.js e persistência no servidor. **Versão atual: MVP executável localmente.**

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
| Prévia local | Rollup, plugins CommonJS/Node Resolve, TypeScript | Compilação no processo Node |
| Testes | node:test, node:assert/strict | Integração HTTP com banco temporário real |
| Ferramentas | VS Code, Git e GitHub | Edição, histórico e documentação |

## Formação relacionada

Tecnólogo em Análise e Desenvolvimento de Sistemas — Universidade Paulista (UNIP), concluído em 2025, com colação em janeiro de 2026 e diploma registrado em março de 2026.

## Executar

Na pasta do projeto, execute `npm install` e depois `npm start`. No computador, abra `http://localhost:5173`. O terminal também mostra um endereço de rede local, por exemplo `http://192.168.0.10:5173`, que pode ser aberto no celular quando os dois dispositivos estiverem na mesma rede Wi-Fi. Crie uma conta com senha de pelo menos 12 caracteres. O banco é criado automaticamente em `data/zeus.sqlite`.

### Acessar pelo celular

1. Conecte o computador e o celular à mesma rede Wi-Fi.
2. Execute `npm start` no computador.
3. No terminal, procure a linha iniciada por `Celular:`.
4. Digite esse endereço no navegador do celular.
5. Se o Windows exibir um alerta de firewall para o Node.js, permita o acesso em **redes privadas**.

O servidor usa validação de mesma origem: a interface e a API continuam protegidas contra requisições vindas de origens externas não autorizadas.

## Decisões de arquitetura

- SqliteDatabase encapsula conexão, criação do esquema e consultas parametrizadas.
- FinanceRepository persiste gastos, dívidas e metas; toda consulta exige o usuário autenticado.
- AuthService usa hash scrypt com sal aleatório, sessões com expiração e limite de tentativas.
- FinanceApi valida requisições e usa cookies HttpOnly/SameSite.
- Valores financeiros são armazenados como centavos inteiros.

## Verificar

npm test testa a API com SQLite temporário: login, isolamento entre contas, valores inválidos, persistência, exclusão e logout.

## Próximos passos

Recuperação de senha, edição de registros, receitas, filtros por período, deploy da API com HTTPS e sincronização entre dispositivos.

## Autor

[Gabriel Silva — GBLSLVA](https://github.com/GBLSLVA)
