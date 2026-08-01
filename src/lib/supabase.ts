import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const supabaseConfig = {
  hasUrl: Boolean(supabaseUrl),
  hasPublicKey: Boolean(supabaseAnonKey),
};

export function createScopedSupabaseClient(context: {
  agenceId: string | null;
  role: string;
}) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-agence-id": context.agenceId ?? "",
        "x-user-role": context.role,
      },
    },
  });
}
