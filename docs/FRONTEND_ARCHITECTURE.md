# ZEUS Finance — Arquitetura do frontend

## Objetivo

Separar apresentação, orquestração e domínio. O backend permanece o proprietário da regra financeira, por meio das classes `AuthService`, `FinanceRepository`, repositórios especializados e `DatabaseAdapter`.

**POO no React não significa converter componentes em classes.** Usamos os princípios SOLID de forma apropriada: composição, encapsulamento, contratos TypeScript, responsabilidade única, dependência de abstrações e componentes pequenos.

## Componentes introduzidos

| Módulo | Responsabilidade |
| --- | --- |
| `features/navigation/navigation.ts` | Definição tipada central das seções desktop e mobile |
| `features/navigation/NavigationSidebar.tsx` | Exibir navegação e ações da conta; sem acesso a API |
| `features/navigation/MobileNavigation.tsx` | Navegação inferior responsiva para ações frequentes |
| `features/navigation/PageToolbar.tsx` | Título da tela, botão principal e seleção do mês |
| `features/incomes/IncomePage.tsx` | Interface de receitas; recebe dados e callbacks, sem persistir |
| `features/account/AccountSecurityDialogs.tsx` | Formulários de alteração de senha e exclusão |
| `features/overview/OverviewPage.tsx` | Dashboard e novos atalhos financeiros |
| `styles/experience.css` | Camada temática, breakpoints e comportamento visual modular |

`App.tsx` continua responsável por buscar dados, manter estados gerais, coordenar ações e tratar erros. Suas responsabilidades visuais foram reduzidas.

## Princípios utilizados

1. **S — Responsabilidade única:** cada módulo de interface exibe uma funcionalidade; dados e lógica financeira não entram nos componentes de navegação.
2. **O — Aberto/fechado:** novas seções são declaradas em `navigation.ts`, sem reproduzir menus e contagens em múltiplos componentes.
3. **L — Substituição:** componentes são substituíveis quando preservam seus contratos de propriedades; não há heranças artificiais de React.
4. **I — Segregação:** `AccountActions` expressa apenas as operações exigidas pelo menu; cada componente recebe um contrato reduzido.
5. **D — Inversão de dependências:** interfaces recebem callbacks e modelos tipados, sem criar instâncias de API ou conhecer o adaptador SQL.

## Alterações de produto

- Desktop: sidebar refinada, hierarquia visual mais forte, cartões com contraste e ações claras.
- Mobile: barra inferior com Visão geral, Receitas, Gastos, Metas e acesso a Mais; a drawer mantém as oito funcionalidades.
- Dashboard: novas ações rápidas para registrar gasto, consultar orçamento e acompanhar metas.
- Acessibilidade: foco inicial e ciclo de Tab dentro da drawer, Esc para fechar, estados `aria-current` e suporte a movimento reduzido.
- Experiência: design responsivo com container queries, sem novas dependências e sem quebrar o tema escuro.

## Limites de segurança

Esta mudança é do frontend: não altera autenticação, banco, migrations, contabilidade, backups, e-mail ou variáveis Railway. Toda operação financeira continua passando pela API e pelos repositories no servidor.

## Guia para próximas features

- Criar um componente dentro de `src/features/<feature>` para cada conjunto de telas.
- Definir props explícitas e tipos compartilhados em `src/domain`.
- Manter validação financeira no backend; formulário frontend apenas auxilia o usuário.
- Reusar os tokens de `styles/experience.css` e evitar novos overrides no final de `styles.css`.
- Respeitar `prefers-reduced-motion`, responsividade, estados de erro e navegação por teclado.
- Executar `npm test`, `npm run build` e CI PostgreSQL/container antes do merge.

## Pendência arquitetural

O `App.tsx` ainda concentra coordenação de requests e estados. Em uma próxima PR, extrair hooks de sessão, dashboard e persistência em etapas, após testes de integração adicionais; evitar migração arriscada e simultânea de todas as ações.
