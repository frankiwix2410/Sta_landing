#!/usr/bin/env bash
# Prueba el esquema y TODAS las migraciones en un Postgres 16 desechable
# (Docker). Nunca toca Supabase.
#
# Uso: ./scripts/probar-migraciones.sh
#
# Orden: esquema inicial → etapa 1 → semilla con filas como las de producción
# → cada migración posterior DOS veces (idempotencia) → pruebas de
# supabase/tests/. Cualquier error corta el script (ON_ERROR_STOP).

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENEDOR="pg-sta-prueba"
ETAPA1="supabase/migrations/20261013_01_talleres.sql"

docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
docker run --rm -d --name "$CONTENEDOR" -e POSTGRES_PASSWORD=x postgres:16 >/dev/null
trap 'docker stop "$CONTENEDOR" >/dev/null 2>&1 || true' EXIT

# La imagen arranca un servidor temporal para inicializarse y lo reinicia:
# hay que esperar a que termine ese primer arranque, no solo a que responda.
for _ in $(seq 1 60); do
  if docker logs "$CONTENEDOR" 2>&1 | grep -q "PostgreSQL init process complete"; then
    docker exec "$CONTENEDOR" pg_isready -U postgres -q && break
  fi
  sleep 1
done

sql() { docker exec -i "$CONTENEDOR" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
archivo() { echo "== $1"; sql < "$RAIZ/$1"; }

# Lo mínimo de Supabase que el esquema da por hecho: roles y storage.buckets.
sql -c "create role anon; create role authenticated; create role service_role;
        create schema storage;
        create table storage.buckets (id text primary key, name text, public boolean,
          file_size_limit bigint, allowed_mime_types text[]);"

archivo supabase/schema.sql
archivo "$ETAPA1"
archivo supabase/tests/semilla_produccion.sql

for m in "$RAIZ"/supabase/migrations/*.sql; do
  rel="supabase/migrations/$(basename "$m")"
  [ "$rel" = "$ETAPA1" ] && continue
  archivo "$rel"
  archivo "$rel"   # idempotencia
done

for t in migracion_inscripciones talleres inscripciones certificados; do
  if [ -f "$RAIZ/supabase/tests/$t.sql" ]; then archivo "supabase/tests/$t.sql"; fi
done

echo "Todo en verde."
