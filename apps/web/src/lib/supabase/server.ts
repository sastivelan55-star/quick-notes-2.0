import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const DEFAULT_SUPABASE_URL = 'https://cgfrebfcnreaabiqjnbd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_AhpRAW8zXGPdzfY13gRyxA_G5l8uOxP';

function getSupabaseCredentials(): { url: string; key: string } {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const url =
    envUrl && envUrl !== 'https://your-project.supabase.co' && !envUrl.includes('your-project')
      ? envUrl
      : DEFAULT_SUPABASE_URL;

  const key =
    envKey && envKey !== 'your-anon-key-here' && !envKey.includes('your-anon-key')
      ? envKey
      : DEFAULT_SUPABASE_ANON_KEY;

  return { url, key };
}

function isConfigured(): boolean {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key);
}

// Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
export async function createServerSupabaseClient() {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) {
    return null;
  }

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
