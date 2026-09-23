# ZEUS Finance — Beta gratuito na nuvem

Arquitetura alvo:

```text
GitHub -> Render Free (Node + React) -> Supabase Free (PostgreSQL)
```

## 1. Supabase

Crie um projeto gratuito no Supabase.

No painel do projeto:

1. Abra **Connect**.
2. Escolha **Session pooler**.
3. Copie a connection string.
4. Troque o campo da senha pela senha do banco.
5. Garanta que a URL termine com `?sslmode=require` quando indicado pelo painel.

O ZEUS aplica as migrations automaticamente no primeiro boot. Não é necessário criar as tabelas manualmente.

## 2. Render

Crie um **Blueprint** usando este repositório GitHub.

O arquivo `render.yaml` já define:

- runtime Node;
- plano Free;
- build `npm ci --include=dev && npm run build`;
- start `npm start`;
- health check em `/api/health`;
- `NODE_ENV=production`;
- `TRUST_PROXY=1`.

No campo secreto `DATABASE_URL`, cole a connection string do Session Pooler do Supabase.

> **Importante:** em produção o ZEUS agora se recusa a iniciar sem `DATABASE_URL`. Isso evita que contas e registros sejam gravados no disco temporário do Render e desapareçam após reinício ou novo deploy.

## 3. Primeiro deploy

No primeiro start:

1. o Render inicia `server/launch.mjs`;
2. como `NODE_ENV=production`, o launcher carrega `server/production.mjs`;
3. `openDatabase()` detecta `DATABASE_URL`;
4. o adaptador PostgreSQL conecta no Supabase;
5. as migrations 1–6 são aplicadas;
6. o health check confirma aplicação + banco;
7. o domínio `*.onrender.com` fica disponível.

## 4. Desenvolvimento local continua igual

Sem `NODE_ENV=production` e sem `DATABASE_URL`:

```bash
npm start
```

continua abrindo a prévia local e usando:

```text
data/zeus.sqlite
```

## 5. Como confirmar o deploy

Abra:

```text
https://SEU-SERVICO.onrender.com/api/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "database": "postgres"
}
```

Depois abra a raiz do domínio, crie uma conta de teste e registre uma receita/gasto.

### Onde os usuários aparecem no Supabase

O ZEUS usa o **PostgreSQL do Supabase**, mas ainda mantém autenticação própria. Portanto, as contas **não aparecem em `Authentication > Users`** do Supabase.

Os usuários ficam em:

```text
Table Editor -> public -> users
```

A coluna `password` guarda somente `salt:hash` gerado com `scrypt`; a senha original não é salva em texto puro.

## 6. Limitações do beta gratuito

O Render Free pode suspender a instância após inatividade. O primeiro acesso depois disso pode demorar enquanto o serviço inicia novamente.

O objetivo desta arquitetura é teste com usuários, não produção comercial.

## 7. Dados que testers não devem cadastrar

No beta, não solicite nem armazene:

- senha bancária;
- número completo de cartão;
- código de segurança de cartão;
- credenciais de internet banking.

O ZEUS não precisa dessas informações.

## 8. Próximas evoluções depois do beta

- recuperação de senha por e-mail;
- política de privacidade;
- logs estruturados;
- migração de regras financeiras do frontend para endpoint de dashboard;
- testes de integração PostgreSQL.
