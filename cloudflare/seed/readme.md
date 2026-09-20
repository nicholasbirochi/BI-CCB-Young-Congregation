# Seed privado

Esta pasta não guarda a base real.

Para importar os registros no Cloudflare D1, gere um seed local em
`cloudflare/private/seed/current_data.sql`:

```bash
npm run db:export
npm run db:seed:remote
```

`cloudflare/private/` fica ignorado no Git. Apague essa pasta depois de
importar se for compactar ou enviar o projeto manualmente.
