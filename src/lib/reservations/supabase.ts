import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase de servidor.
 *
 * Usa la clave `service_role`, que se salta RLS y puede leer todas las
 * reservas: NUNCA debe llegar al navegador. Por eso el nombre de la variable no
 * lleva el prefijo `NEXT_PUBLIC_` y este módulo solo se importa desde server
 * actions y componentes de servidor.
 */

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Devuelve el cliente, o `null` si faltan credenciales.
 *
 * La inicialización es perezosa a propósito: crear el cliente en el nivel
 * superior del módulo revienta `next build` en cualquier entorno donde todavía
 * no estén las variables. Con `null`, el sitio compila y despliega sin Supabase
 * y el server action cae al modo "solo logs".
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !serviceKey) return null;

  client ??= createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

/** `true` si el proyecto tiene Supabase configurado. */
export const supabaseConfigured = Boolean(url && serviceKey);
