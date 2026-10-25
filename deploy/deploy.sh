#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MODE="${1:-}"
if [[ "$MODE" != initial && "$MODE" != update ]]; then
    echo "Uso: bash deploy/deploy.sh initial|update" >&2
    exit 1
fi
dc() { bash "$ROOT/deploy/compose.sh" "$@"; }
dc config --quiet
dc build --pull backend
dc up -d --wait db
dc run --rm --no-deps backend python manage.py check --deploy --tag security --fail-level WARNING
dc run --rm --no-deps backend python manage.py migrate --plan
if [[ "$MODE" == update ]]; then
    # Deja mantenimiento activo hasta terminar las migraciones.
    bash "$ROOT/deploy/backup.sh" --keep-stopped
fi
dc run --rm --no-deps backend python manage.py migrate --noinput
dc up -d --wait --wait-timeout 180 backend caddy
dc ps
echo "Verifica ahora https://DOMINIO_API/api/v1/health/ y los flujos desde Netlify."
