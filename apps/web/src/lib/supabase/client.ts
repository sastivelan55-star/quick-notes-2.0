import { createBrowserClient } from '@supabase/ssr';

// Creates a Supabase client for use in browser/client components.
// Falls back gracefully when env vars are not configured.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === 'https://your-project.supabase.co') {
    // Return a dummy client-like object when not configured.
    // All operations will be no-ops, allowing the app to run offline-only.
    console.warn('[FlowNote] Supabase not configured. Running in local-only mode.');
    return null;
  }

  return createBrowserClient(url, key);
}

export type SupabaseClient = ReturnType<typeof createBrowserClient>;
