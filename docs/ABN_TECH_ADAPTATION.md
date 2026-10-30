# Tecnologias e técnicas de abn.ooo adaptadas ao ZEUS Finance

Referência visual: https://abn.ooo/projects/  
Código-fonte público consultado: https://github.com/Todomir/todomir.dev

## Stack observada na referência

O portfólio usa **Qwik / Qwik City, TypeScript e Vite** para renderizar páginas e **Tailwind CSS** para o estilo, além do pacote **Motion** para animar a lista de projetos com entrada sequencial (stagger). Ele também demonstra componentes reutilizáveis, imagens com dimensões explícitas e um link para pular direto ao conteúdo.

As etiquetas React, Astro, Next.js, Storybook, Odoo, Contentful e Storyblok vistas no site descrevem as tecnologias dos projetos apresentados, e **não a implementação de todo o portfólio**.

## Implementação no ZEUS — etapa 1

| Referência | Adaptação | Motivo |
| --- | --- | --- |
| Motion e entradas em sequência | Hook `useStaggeredReveal` com `Element.animate()` nativo | Mesmo padrão visual sem instalar um runtime de animação no dashboard financeiro |
| Layout responsivo por componente | CSS `@container` no dashboard | Adaptar cards e gráficos à largura real, não só à viewport |
| Navegação acessível | Link «Pular para o conteúdo», landmark focável e Esc para fechar a sidebar mobile | Facilitar navegação por teclado |
| Metadados por página | `document.title` reage à seção aberta | Melhor contexto nas abas e no histórico do navegador |
| Motion opcional | Verificação de `prefers-reduced-motion` e fallback sem API de animação | Acessibilidade, estabilidade e desempenho |

As animações são exclusivamente decorativas. Nenhum cálculo financeiro, login, banco ou endpoint foi modificado.

## Tecnologias que não foram adicionadas nesta etapa

- **Qwik, Astro e Next.js:** substituir React e o backend Node.js exigiria reescrever o sistema e traz risco desproporcional.
- **Tailwind CSS:** o ZEUS já utiliza uma identidade e tokens próprios, portanto continuar com CSS moderno é mais sustentável.
- **Motion npm:** a animação desejada é pequena e pode ser feita diretamente com Web Animations API sem aumentar o bundle.
- **Storybook:** pode entrar em uma etapa específica de testes/documentação de componentes se os benefícios justificarem as dependências.
- **Odoo, Contentful e Storyblok:** são tecnologias de projetos da vitrine e não exigências da aplicação financeira.

## Checklist de aceitação

1. Desktop: os indicadores entram uma única vez com atraso sutil, sem interferir nos valores.
2. Acessibilidade: `prefers-reduced-motion: reduce` desativa as animações decorativas.
3. Celular: layout adapta-se a uma ou duas colunas conforme a largura real do painel.
4. Teclado: o primeiro Tab apresenta o link de pular conteúdo; Esc fecha o menu lateral.
5. A aba do navegador mostra o título da seção atual.
6. Sem suporte à Web Animations API ou Container Queries, a aplicação permanece legível e funcional usando o CSS e o comportamento existentes.
7. CI: testes Node, build React/TypeScript, PostgreSQL e container precisam passar antes do merge.

Não copiar imagens, texto autoral nem código-fonte do site. O objetivo é aproveitar **padrões técnicos**, mantendo a identidade ZEUS.
