# ZEUS Finance — Auditoria e correção de espaçamento

## Problemas encontrados

1. **Categorias:** o formulário de cada categoria ocupava cinco colunas rígidas, incluindo campo de texto, cor, badge e botões. Em painéis com sidebar, o conjunto podia ficar apertado e os controles perderem alinhamento.
2. **Recorrentes:** a tabela exigia pelo menos 600px de largura em um painel dividido com um formulário lateral. Em resoluções comuns, isso criava rolagem horizontal e dificultava visualizar vencimento, situação e ações.
3. **Resumos financeiros:** grades de três indicadores foram definidas com quatro colunas CSS, deixando uma faixa vazia e cartões estreitos. Isso também atingia detalhes de orçamento e receitas.
4. **Ritmo vertical:** regras legadas combinavam gaps e paddings diferentes nas mesmas seções; o mínimo de altura de 540px para listas vazias criava espaço morto.

## Padrão adotado

A escala única está em `src/styles/layout-rhythm.css`, importada depois do tema `experience.css`.

| Token | Valor | Uso |
| --- | --- | --- |
| `--space-1` | 4px | Destaques e microespaços |
| `--space-2` | 8px | Ícone/texto e label/input |
| `--space-3` | 12px | Ações relacionadas |
| `--space-4` | 16px | Gap de inputs, painéis compactos |
| `--space-5` | 20px | Linhas de listagem |
| `--space-6` | 24px | Seções e cabeçalho de cards |
| `--space-8` | 32px | Área externa da página |
| `--space-10` | 40px | Separações maiores quando necessárias |

Variáveis semânticas `--content-gap`, `--section-gap`, `--panel-pad` ajustam os espaços por breakpoint, sem alterar a marca visual.

## Páginas

- **Categorias:** estrutura flexível nome + cor em uma linha e ações/badge em uma segunda linha; inputs de nome explicitamente estilizados; 44px mínimo para botões; preserva formulários e callbacks.
- **Recorrentes:** listagem em cards sem largura mínima de tabela; valor, vencimento e vigência em grid; status visível e botão de marcar pago somente quando aplicável. O formulário usa campo de vencimento e data sem dividir uma sidebar estreita.
- **Outras telas:** correção de grades com três indicadores, remoção do mínimo de altura artificial para listas, padronização de margens, formulário e conteúdo.
- **Desktop/tablet/mobile:** painel + formulário em duas colunas apenas com espaço suficiente; uma coluna em telas intermediárias; margens e grids menores em telas pequenas.

## Checklist para validar em produção

- Visual: testar 320px, 375px, 430px, 768px, 1024px, 1366px e 1920px.
- Categorias: nome longo, cor, salvar, remover e selo Inicial, com lista vazia e cheia.
- Recorrentes: pendente, pago e fora da vigência; editar, excluir e marcar pago; verificar formulário nos breakpoints.
- Sem rolagem horizontal geral da página; botões não podem se sobrepor.
- Contraste/foco/teclado e menu inferior devem seguir acessíveis.
- Testes de API/TypeScript, build, PostgreSQL e container precisam passar antes do merge.

Não há mudanças no backend, no banco, nas rotas ou nas regras financeiras.
