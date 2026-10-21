import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function isConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url === 'https://your-project.supabase.co' || url.includes('your-project')) return false;
  if (key === 'your-anon-key-here' || key.includes('your-anon-key')) return false;
  return true;
}

// Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
export async function createServerSupabaseClient() {
  if (!isConfigured()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — cannot set cookies. Handled by middleware or route handlers.
        }
      },
    },
  });
}

// Creates a Supabase Admin client for server-side privileged operations.
// NEVER expose the service role key to clients.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || !isConfigured()) {
    return null;
  }

  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
