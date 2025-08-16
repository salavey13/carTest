import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Fail fast in development so it's easy to notice config issues.
    // In production the client will likely fail gracefully on network calls.
    console.warn("[supabase-browser] Missing NEXT_PUBLIC_SUPABASE_* env vars. Realtime / client features will not work.");
  }

  _supabase = createClient(url ?? "", key ?? "", {
    realtime: {
      // You can tune the heartbeat / presence settings here if needed
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return _supabase;
}