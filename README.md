# ZEUS Finance

Painel financeiro responsivo construído com React, TypeScript e Vite para acompanhar gastos, dívidas e metas em celular e desktop.

## Stack

- React 18 com componentes reutilizáveis
- TypeScript em modo strict
- Vite para desenvolvimento e build rápido
- CSS responsivo com design system próprio
- Persistência local encapsulada em repositórios orientados a objetos

## Arquitetura

- src/domain.ts: entidades Transaction e Goal, FinanceRepository para persistência e FinanceAnalyzer para regras de análise.
- src/App.tsx: composição das telas e fluxo de interação.
- src/styles.css: tema visual e breakpoints para mobile, tablet e desktop.

## Como executar

    npm install
    npm run dev
    npm run build

Os dados desta versão ficam apenas no armazenamento local do navegador. Para dados reais, a próxima etapa é adicionar autenticação, API, banco de dados, criptografia e sincronização entre dispositivos.

## Autor

[Gabriel Silva — GBLSLVA](https://github.com/GBLSLVA)
