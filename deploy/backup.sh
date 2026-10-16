#!/usr/bin/env bash
# Ejecutar con acceso Docker. Breve ventana sin escrituras para coherencia DB/media.
set -euo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
dc() { bash "$ROOT/deploy/compose.sh" "$@"; }
KEEP_STOPPED=false
if [[ "${1:-}" == --keep-stopped ]]; then KEEP_STOPPED=true;
elif [[ $# -gt 0 ]]; then echo "Uso: bash deploy/backup.sh [--keep-stopped]" >&2; exit 1; fi
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/backups/$STAMP"
mkdir -p "$OUT"
# No reactivar automaticamente tras un fallo: no servir datos incoherentes.
DEPLOYED_CONTAINER="$(dc ps -aq backend)"
if [[ -z "$DEPLOYED_CONTAINER" ]]; then echo "No hay backend desplegado del que registrar version." >&2; exit 1; fi
DEPLOYED_COMMIT="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$DEPLOYED_CONTAINER")"
if [[ -z "$DEPLOYED_COMMIT" || "$DEPLOYED_COMMIT" == unversioned ]]; then echo "Imagen sin revision; registrar version antes del backup." >&2; exit 1; fi
dc stop caddy backend
dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$OUT/database.dump"
dc run --rm --no-deps -T --entrypoint tar backend -C /app/media -czf - . > "$OUT/media.tar.gz"
printf '%s\n' "$DEPLOYED_COMMIT" > "$OUT/commit.txt"
dc images backend > "$OUT/images.txt"
(cd "$OUT" && sha256sum database.dump media.tar.gz commit.txt images.txt > SHA256SUMS)
echo "Backup completo: $OUT"
echo "Copiar cifrado fuera de la VM; guardar .env.production por separado en gestor de secretos."
if [[ "$KEEP_STOPPED" == false ]]; then
    dc up -d --wait --wait-timeout 180 backend caddy
fi
