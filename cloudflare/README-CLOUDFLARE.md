# BI CCB no Cloudflare

Esta pasta contém a versão pronta para Cloudflare Workers + Static Assets + D1.
O app Flask local continua preservado em `src/`; esta versão online usa o mesmo
modelo de dados, mas roda sem Python em produção.

## Segurança dos dados

A base real não fica em `public/` e não deve ser enviada para o GitHub.
O Worker acessa os registros apenas pelo binding privado do Cloudflare D1.

Arquivos sensíveis ficam ignorados no Git:

- `../src/data/*.db*`
- `private/seed/*.sql`
- `.dev.vars`
- `.wrangler/`
- qualquer `.env`

O seed real é gerado localmente apenas na hora de importar para o D1.

## O que foi preparado

- `src/worker.js`: API do sistema no Cloudflare Worker.
- `public/`: frontend estático, assets, gráficos e dados auxiliares públicos.
- `migrations/0001_schema.sql`: schema do banco D1, sem registros reais.
- `scripts/export_sqlite_to_d1.py`: gera o seed privado a partir do SQLite local.
- `seed/README.md`: lembrete de que a pasta não guarda base real.

## Publicar

1. Instale dependências:

```bash
cd cloudflare
npm install
```

2. Faça login:

```bash
npx wrangler login
```

3. Crie o D1:

```bash
npx wrangler d1 create ccb-bi
```

4. Copie o `database_id` que o Wrangler mostrar e substitua o placeholder em
`wrangler.jsonc`.

5. Configure os segredos:

```bash
npx wrangler secret put SENHA_COOPERADOR
npx wrangler secret put SENHA_CONTAGEM
npx wrangler secret put SESSION_SECRET
```

6. Aplique o schema:

```bash
npm run db:migrate:remote
```

7. Gere o seed privado local e importe para o D1:

```bash
npm run db:export
npm run db:seed:remote
```

8. Publique:

```bash
npm run deploy
```

9. Depois da importação, apague `cloudflare/private/` se for compactar/enviar a
pasta manualmente. Essa pasta já fica fora do Git.

## Rodar localmente antes de publicar

Crie `.dev.vars` a partir de `.dev.vars.example`, depois rode:

```bash
npm run db:migrate:local
npm run db:export
npm run db:seed:local
npm run dev
```

## Conferir antes de subir para GitHub

No clone do repositório, rode:

```bash
git status --short
git check-ignore -v src/data/ccb.db cloudflare/private/seed/current_data.sql
git ls-files | grep -E '(^|/)(data|private|seed)/.*\.(db|sql)|\.dev\.vars|\.env$'
```

O último comando não deve listar nada. Se listar algo sensível que já esteja
rastreado, remova do índice sem apagar do computador:

```bash
git rm --cached src/data/ccb.db
git rm --cached cloudflare/seed/001_current_data.sql
git rm --cached cloudflare/seed/export-summary.json
```

Depois confirme de novo com `git status --short`.

## Atualizar os dados depois

Se você continuar usando o Flask local para digitar/importar dados e quiser
reenviar para o D1:

```bash
npm run db:export
npm run db:seed:remote
```

Esse comando apaga e recria os registros no D1 com base no seed privado gerado
localmente.
