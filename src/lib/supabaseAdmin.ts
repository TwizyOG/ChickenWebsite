import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Service-role Supabase client — SERVER ONLY (API routes / OAuth callback).
   Bypasses RLS; never import from client components. Degrades to null when
   env is missing so builds and the static export never break. */

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
