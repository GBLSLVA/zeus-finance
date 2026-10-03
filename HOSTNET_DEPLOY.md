# Deploy do ZEUS Finance na Hostnet

Este guia deixa o ZEUS pronto para migrar do Render para a Hostnet sem mover o banco na primeira etapa.

## Arquitetura recomendada

Primeira fase:

```text
Internet
  -> Hostnet App Cloud
      -> container ZEUS Finance (Node.js 24)
          -> Supabase PostgreSQL
          -> Resend
```

O banco permanece no Supabase durante a migração. Isso reduz o risco de perda de usuários e dados.

## Importante sobre o plano Hostnet

A Hospedagem Cloud tradicional e o Hostnet App Cloud são produtos diferentes.

O ZEUS precisa executar Node.js continuamente e aceitar requisições HTTP da API. Para usar este repositório sem reescrever o backend, o ambiente Hostnet precisa aceitar containers Docker/Node.js.

Se o plano contratado for apenas Hospedagem Cloud tradicional, abra um chamado na Hostnet solicitando:

> Tenho uma aplicação full stack Node.js 24 + React, empacotada em Docker, com PostgreSQL externo no Supabase. Gostaria de executar a imagem no Hostnet App Cloud ou confirmar se meu plano atual permite aplicação Node.js/container persistente.

## Imagem do container

O repositório possui um `Dockerfile` multi-stage.

Configuração esperada:

- porta interna: `10000`;
- comando: `npm start`;
- healthcheck: `GET /api/health`;
- processo executado como usuário não-root;
- frontend React servido pelo mesmo processo Node;
- PostgreSQL externo via `DATABASE_URL`.

O workflow `.github/workflows/container.yml` publica a imagem em:

```text
ghcr.io/gblslva/zeus-finance:latest
```

Também são publicadas tags baseadas no SHA do commit.

## Variáveis de ambiente

Configure na Hostnet:

```text
NODE_ENV=production
PORT=10000
TRUST_PROXY=1
APP_TIMEZONE=America/Sao_Paulo
APP_ORIGIN=same-origin
APP_BASE_URL=https://SEU-DOMINIO
DB_POOL_MAX=5
DATABASE_URL=...
RESEND_API_KEY=...
PASSWORD_RESET_EMAIL_FROM=...
```

Use como referência `deploy/hostnet.env.example`.

### Segredos

Nunca envie para o GitHub:

- `DATABASE_URL`;
- `RESEND_API_KEY`;
- senhas;
- tokens.

Esses valores devem existir apenas nas variáveis secretas da Hostnet.

## Banco de dados

Na primeira migração, mantenha o Supabase.

O ZEUS exige `DATABASE_URL` em produção e não inicia com SQLite temporário. Isso protege contas, lançamentos, dívidas, metas e categorias contra perda após reinício do container.

Não configure:

```text
ALLOW_SQLITE_PRODUCTION=1
```

Essa flag existe somente para smoke tests isolados do CI.

## Domínio e HTTPS

Durante a homologação, use primeiro o endereço provisório fornecido pela Hostnet.

Quando os testes passarem:

1. configure o domínio na Hostnet;
2. confirme o certificado HTTPS;
3. altere `APP_BASE_URL` para a URL HTTPS definitiva;
4. teste a recuperação de senha;
5. somente depois altere o DNS definitivo.

## Checklist de homologação

Antes de desligar o Render, valide na Hostnet:

- `/api/health` responde `status: ok`;
- o healthcheck informa banco `postgres` e `persistent: true`;
- cadastro de usuário;
- logout e novo login;
- login após reinício/redeploy do container;
- recuperação de senha por e-mail;
- receitas;
- gastos;
- categorias personalizadas;
- recorrências;
- orçamentos;
- dívidas e pagamentos;
- metas e movimentações;
- dashboard;
- ZEUS Insights;
- Pergunte ao ZEUS;
- exportação JSON;
- restauração de backup;
- exportação CSV;
- acesso pelo celular;
- HTTPS.

## Estratégia de corte

Não desligue o Render antes da homologação.

Sequência segura:

```text
1. Hostnet sobe o container
2. Hostnet usa o mesmo Supabase
3. testar URL provisória
4. testar persistência após reinício
5. configurar domínio/SSL
6. atualizar APP_BASE_URL
7. alterar DNS
8. acompanhar produção
9. retirar Render
```

Se algo falhar depois da troca do DNS, volte temporariamente o DNS para o Render enquanto a correção é feita.

## Teste local do container

Com Docker instalado:

```bash
docker build -t zeus-finance:local .
docker run --rm -p 10000:10000 \
  -e NODE_ENV=production \
  -e PORT=10000 \
  -e TRUST_PROXY=1 \
  -e APP_ORIGIN=same-origin \
  -e APP_BASE_URL=http://localhost:10000 \
  -e DATABASE_URL="SUA_DATABASE_URL" \
  zeus-finance:local
```

Abra:

```text
http://localhost:10000
http://localhost:10000/api/health
```

## Informações para enviar ao suporte Hostnet

```text
Aplicação: ZEUS Finance
Stack: Node.js 24 + React/Vite
Formato: Docker OCI
Imagem: ghcr.io/gblslva/zeus-finance:latest
Porta interna: 10000
Healthcheck: /api/health
Banco: PostgreSQL externo (Supabase)
HTTPS: necessário
Proxy reverso: necessário
WebSocket: não é necessário atualmente
Volume persistente: não é necessário enquanto o banco estiver no Supabase
Arquitetura: single-container
```
