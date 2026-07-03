import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Supabase browser client for the site account (regular email/password login),
   matching the original chickenandy.vercel.app. Fully client-side (calls go to
   *.supabase.co), so it works on both the Vercel app and the static Pages mirror.
   Configure via NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY; until
   then it degrades to "not configured" without breaking the build. */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
