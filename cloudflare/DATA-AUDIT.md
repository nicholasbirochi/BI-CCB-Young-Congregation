# Auditoria de data antes do Cloudflare

Resumo do que foi consolidado antes de preparar o deploy online.

## Corrigido

- Registro `177` (`2026-07-05`): `CDMU` foi corrigido para `CDHU`, seguindo a conferência visual registrada no histórico do trabalho anterior.
- O banco local foi salvo antes da correção em `src/data/ccb.db.backup-pre-cloudflare-YYYYMMDD-HHMMSS`.
- O seed do D1 foi regenerado depois da correção, mas não fica salvo no pacote
  público. Gere novamente com `npm run db:export` quando for importar.

## Já estava aplicado no banco

- Modo `recitativo_coletivo` nos registros `177`, `178` e `179`.
- Totais coletivos:
  - `177`: irmãs `95`, irmãos `79`, geral `174`.
  - `178`: irmãs `94`, irmãos `67`, geral `161`.
  - `179`: irmãs `110`, irmãos `105`, geral `215`.
- Padronizações principais de visitas e nomes, incluindo `Jhonatan`, `Araruçaia`, `Monte Líbano`, `Terra Nova II`, `Jardim Represa`, `Jardim Fátima`, `Jardim Leblon` e outras variações de alta confiança.

## Revisão manual pendente

No registro `177`, duas visitas continuam com localidade possivelmente resolvida por homônimo:

- `Alto da Bela Vista - Central — Riachão Do Jacuípe, BA, Brasil`
- `Jardim Monte Líbano - Santo Amaro — São Paulo, SP, Brasil`

Elas foram mantidas sem alteração porque podem representar congregações reais fora da região local. Vale revisar no formulário original antes de padronizar.
