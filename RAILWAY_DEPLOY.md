# Deploy do ZEUS Finance no Railway

O Railway é a infraestrutura oficial de produção do ZEUS Finance.

## Arquitetura

```text
GitHub: GBLSLVA/zeus-finance
branch: main
        |
        v
Railway project: ZEUS Finance
  |
  +-- zeus-finance
  |     React + Node.js
  |     healthcheck: /api/health
  |     domínio: zeus-finance-production.up.railway.app
  |
  +-- Postgres
        PostgreSQL persistente
        volume: /var/lib/postgresql/data
```

## Fluxo de deploy

1. O código fonte fica no GitHub.
2. O serviço `zeus-finance` acompanha a branch `main`.
3. O Railway constrói e publica a nova versão.
4. O healthcheck `/api/health` precisa responder com sucesso.
5. A aplicação usa `DATABASE_URL` para acessar o Postgres do mesmo projeto.

## Variáveis da aplicação

Variáveis esperadas em produção:

```text
NODE_ENV=production
DATABASE_URL=...
DB_POOL_MAX=...
TRUST_PROXY=...
APP_BASE_URL=...
RESEND_API_KEY=...
PASSWORD_RESET_EMAIL_FROM=...
```

`APP_TIMEZONE` pode ser definido explicitamente; quando ausente, o ZEUS usa `America/Sao_Paulo` como padrão.

Nunca salve chaves, senhas ou connection strings reais no GitHub.

## Banco de dados

Em produção, o ZEUS exige PostgreSQL persistente. O serviço Postgres do Railway possui volume montado em:

```text
/var/lib/postgresql/data
```

O SQLite continua sendo usado apenas no desenvolvimento local e nos testes apropriados.

## Verificação após deploy

Confirme:

- deployment do serviço `zeus-finance` com status de sucesso;
- deployment do `Postgres` saudável;
- `GET /api/health` respondendo `status: ok`;
- `database: postgres`;
- `persistent: true`;
- cadastro e login;
- receitas e gastos;
- dívidas, metas, recorrências e orçamentos;
- backup/restauração e exportação;
- recuperação de senha por e-mail.

## Domínio

Enquanto não houver domínio próprio conectado, o endereço de produção é:

```text
https://zeus-finance-production.up.railway.app
```

Quando um domínio próprio for adotado, ele deve ser configurado no serviço `zeus-finance` e o `APP_BASE_URL` deve acompanhar a URL HTTPS definitiva.
