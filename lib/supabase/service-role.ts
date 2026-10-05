import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente service_role — bypasa RLS. Solo para LECTURAS del panel y siempre
 * después de requireAdmin(). Las escrituras de permisos van por RPC con la
 * sesión del admin (lib/supabase/server.ts) para que queden auditadas.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
