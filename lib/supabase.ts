import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// pinka.finance backend = domovina-api Supabase (self-hosted, api.domovina.ai).
// Schema `pinka_finance` + edge fns `pinka-contribute` / `pinka-webhook`.
// Anon key is public-safe; all access is RLS-gated (see platform plan §3).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
}

/// Server-side client (RSC / route handlers) — anon key, no session. Sufficient
/// for public campaign reads (RLS allows public+active campaigns to anon).
export function supabaseServer(): SupabaseClient {
  assertConfigured();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/// Browser singleton — persists an (anonymous) session so the contribute edge
/// function and own-contribution polling are authenticated.
let _browser: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient {
  assertConfigured();
  if (_browser) return _browser;
  _browser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _browser;
}

/// Ensures there is at least an anonymous session before calling the edge fn.
export async function ensureSession(client: SupabaseClient): Promise<void> {
  const { data } = await client.auth.getSession();
  if (!data.session) {
    await client.auth.signInAnonymously();
  }
}
