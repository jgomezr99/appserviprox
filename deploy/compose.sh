#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export SERVIPROX_ENV_FILE="$ROOT/.env.production"
if [[ ! -f "$SERVIPROX_ENV_FILE" ]]; then
    echo "Falta .env.production; copia y completa .env.production.example." >&2
    exit 1
fi
exec docker compose --env-file "$SERVIPROX_ENV_FILE" -f "$ROOT/compose.prod.yml" "$@"
