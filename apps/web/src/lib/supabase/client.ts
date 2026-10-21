import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cache browser client instance across calls to avoid re-instantiation
let clientInstance: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = 'https://cgfrebfcnreaabiqjnbd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_AhpRAW8zXGPdzfY13gRyxA_G5l8uOxP';

/**
 * Resolves Supabase credentials with robust production fallbacks.
 */
export function getSupabaseCredentials(): { url: string; key: string } {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

/**
 * Checks whether Supabase environment variables are present and configured.
 */
export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key);
}

/**
 * Creates or retrieves the singleton Supabase client for browser/client components.
 * Returns null if Supabase is not configured, enabling safe offline/local mode.
 */
export function createClient(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;

  if (typeof window === 'undefined') {
    return createBrowserClient(url, key);
  }

  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = createBrowserClient(url, key);
  return clientInstance;
}

/**
 * Initiates Google OAuth sign-in flow.
 * Returns { data, error }.
 */
export async function signInWithGoogle(returnUrl: string = '/app') {
  const supabase = createClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'),
    };
  }

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`
    : `/auth/callback?next=${encodeURIComponent(returnUrl)}`;

  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });
}

/**
 * Signs in with email and password.
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  return await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
}

/**
 * Registers a new user with email, password, and optional display name.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
  returnUrl: string = '/app'
) {
  const supabase = createClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`
    : `/auth/callback?next=${encodeURIComponent(returnUrl)}`;

  return await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: callbackUrl,
      data: displayName ? { display_name: displayName.trim(), full_name: displayName.trim() } : undefined,
    },
  });
}

/**
 * Requests a password reset email from Supabase Auth.
 */
export async function resetPasswordForEmail(email: string, returnUrl: string = '/auth/reset-password') {
  const supabase = createClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`
    : `/auth/callback?next=${encodeURIComponent(returnUrl)}`;

  return await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: callbackUrl,
  });
}

/**
 * Updates the user's password (used when authenticated or from a password reset link).
 */
export async function updateUserPassword(newPassword: string) {
  const supabase = createClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  return await supabase.auth.updateUser({
    password: newPassword,
  });
}

/**
 * Signs out the current user session.
 */
export async function signOut() {
  const supabase = createClient();
  if (!supabase) {
    return { error: null };
  }
  return await supabase.auth.signOut();
}

export type { SupabaseClient };

