import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client: SupabaseClient | undefined;

export function createClient() {
  if (!url || !key) throw new Error("Falta la configuración pública de Supabase.");
  if (client) return client;
  client = createSupabaseClient(url, key, {
    auth: { flowType: "pkce", detectSessionInUrl: false },
  });
  return client;
}
