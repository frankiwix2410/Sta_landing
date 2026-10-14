#!/usr/bin/env bash
# Aplica la migración de talleres (supabase/migrations/20261013_01_talleres.sql)
# a TU base de Supabase.
#
# Uso:
#   SUPABASE_DB_URL='postgresql://postgres:TU_CLAVE@HOST:5432/postgres' ./scripts/migrar.sh
#
# Dónde sacar la URL: Supabase → Project Settings → Database → Connection string
# → pestaña URI. Recomendado: el "Session pooler" (los hosts de conexión directa
# son solo IPv6 y suelen fallar desde Docker en macOS). Sustituye
# [YOUR-PASSWORD] por la contraseña de la base de datos.
#
# Usa `psql` si está instalado; si no, Docker (imagen postgres:16).
# Antes de ejecutar, haz un backup en Supabase → Database → Backups.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVO="$RAIZ/supabase/migrations/20261013_01_talleres.sql"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: falta SUPABASE_DB_URL." >&2
  echo "Uso: SUPABASE_DB_URL='postgresql://...' ./scripts/migrar.sh" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO" ]; then
  echo "Error: no existe $ARCHIVO" >&2
  exit 1
fi

# Ejecuta SQL (por stdin) contra la base, sin mostrar nunca la URL.
if command -v psql >/dev/null 2>&1; then
  MODO="psql local"
  correr_sql() { psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 "$@"; }
elif command -v docker >/dev/null 2>&1; then
  MODO="Docker (postgres:16)"
  # --network host no existe en Docker Desktop de Mac; se usa la red por defecto.
  correr_sql() { docker run --rm -i -e SUPABASE_DB_URL postgres:16 \
    sh -c 'psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 "$@"' sh "$@"; }
else
  echo "Error: no hay psql ni docker. Instala uno de los dos." >&2
  exit 1
fi

echo "Se va a aplicar:"
echo "  archivo: supabase/migrations/20261013_01_talleres.sql"
echo "  destino: la base indicada en SUPABASE_DB_URL (no se muestra)"
echo "  cliente: $MODO"
echo "La migración es idempotente y corre dentro de una transacción."
echo
printf 'Escribe "si" para continuar: '
read -r RESPUESTA
if [ "$RESPUESTA" != "si" ]; then
  echo "Cancelado. No se cambió nada."
  exit 1
fi

echo
echo "Aplicando migración..."
correr_sql < "$ARCHIVO"

echo
echo "Verificación: talleres"
correr_sql -c "select slug, estado, titulo, titulo_acento, fecha_inicio, fecha_fin, cupos_total from public.talleres;"
echo "Verificación: disponibilidad"
correr_sql -c "select * from public.talleres_disponibilidad;"
echo
echo "Listo."
