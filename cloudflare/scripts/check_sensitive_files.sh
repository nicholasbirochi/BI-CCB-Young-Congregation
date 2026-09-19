#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Este diretório ainda não é um repositório Git."
  exit 0
fi

matches="$(
  git ls-files | grep -E '(^|/)(data|private|seed)/.*\.(db|sqlite|sqlite3|sql)|(^|/)\.dev\.vars$|(^|/).*\.env$' || true
)"

if [ -n "$matches" ]; then
  echo "Arquivos sensíveis rastreados pelo Git:"
  echo "$matches"
  echo
  echo "Remova do índice com git rm --cached <arquivo> antes de publicar."
  exit 1
fi

echo "OK: nenhum .db, .sql, .env ou .dev.vars sensível está rastreado pelo Git."
