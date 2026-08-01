import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://jlboqvxodxxekwsupxac.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYm9xdnhvZHh4ZWt3c3VweGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1OTM1ODIsImV4cCI6MjEwMTE2OTU4Mn0.jksV5rHnvYibg_H1JELV65WoChtuowPKloh7aMlvNeo";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL) as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY) as string;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseConfig = {
  hasUrl: true,
  hasPublicKey: true,
};

export function createScopedSupabaseClient(context: {
  agenceId: string | null;
  role: string;
}) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-agence-id": context.agenceId ?? "",
        "x-user-role": context.role,
      },
    },
  });
}
