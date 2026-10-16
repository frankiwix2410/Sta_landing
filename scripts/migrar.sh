#!/usr/bin/env bash
# Aplica UNA migración de supabase/migrations/ a TU base de Supabase.
#
# Uso:
#   SUPABASE_DB_URL='postgresql://postgres:TU_CLAVE@HOST:5432/postgres' ./scripts/migrar.sh [archivo]
#
#   archivo: ruta de la migración, relativa a la raíz del repo o absoluta.
#            Sin argumento se toma la MÁS RECIENTE de supabase/migrations/
#            (orden por nombre). Pasa siempre la ruta cuando haya una
#            migración que todavía no toca aplicar.
#
# Si existe supabase/verificaciones/antes_<archivo>, se muestra antes de pedir
# confirmación (consultas de solo lectura sobre el punto de partida). Si existe
# supabase/verificaciones/<archivo>, se ejecuta después.
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

if [ $# -gt 0 ]; then
  case "$1" in
    /*) ARCHIVO="$1" ;;
    *) ARCHIVO="$RAIZ/$1" ;;
  esac
else
  ULTIMA="$(ls "$RAIZ/supabase/migrations" | grep '\.sql$' | sort | tail -n 1)"
  ARCHIVO="$RAIZ/supabase/migrations/$ULTIMA"
fi

NOMBRE="$(basename "$ARCHIVO")"
ANTES="$RAIZ/supabase/verificaciones/antes_$NOMBRE"
DESPUES="$RAIZ/supabase/verificaciones/$NOMBRE"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: falta SUPABASE_DB_URL." >&2
  echo "Uso: SUPABASE_DB_URL='postgresql://...' ./scripts/migrar.sh [archivo]" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO" ]; then
  echo "Error: no existe $ARCHIVO" >&2
  exit 1
fi

# Ejecuta SQL (por stdin o con -c) contra la base, sin mostrar nunca la URL.
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

if [ -f "$ANTES" ]; then
  echo "Punto de partida (solo lectura):"
  correr_sql < "$ANTES" || echo "(La comprobación previa falló: ¿la migración ya estaba aplicada?)"
  echo
fi

echo "Se va a aplicar:"
echo "  archivo: ${ARCHIVO#"$RAIZ"/}"
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

if [ -f "$DESPUES" ]; then
  echo
  echo "Verificación:"
  correr_sql < "$DESPUES"
fi

echo
echo "Listo."
