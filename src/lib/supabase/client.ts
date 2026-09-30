import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  if (!url || !key) throw new Error("Falta la configuración pública de Supabase.");
  return createSupabaseClient(url, key, {
    auth: { flowType: "pkce", detectSessionInUrl: false },
  });
}
