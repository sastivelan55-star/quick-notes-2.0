import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSafeReturnUrl } from '@/lib/auth/url';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next');
  const oauthError = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  const defaultDestination = type === 'recovery' ? '/auth/reset-password' : '/app';
  const safeNext = getSafeReturnUrl(next, defaultDestination);

  // Handle provider / OAuth error returned in query params
  if (oauthError) {
    const errorMsg = errorDescription || oauthError;
    const loginUrl = new URL('/auth/login', requestUrl.origin);
    loginUrl.searchParams.set('error', errorMsg);
    return NextResponse.redirect(loginUrl);
  }

  if (code || tokenHash) {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      const loginUrl = new URL('/auth/login', requestUrl.origin);
      loginUrl.searchParams.set('error', 'Supabase credentials are not configured on this server.');
      return NextResponse.redirect(loginUrl);
    }

    let authError: Error | null = null;

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) authError = error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });
      if (error) authError = error;
    }

    if (authError) {
      console.error('[LifeMap OS Auth] Verification error:', authError.message);
      const loginUrl = new URL('/auth/login', requestUrl.origin);
      loginUrl.searchParams.set('error', authError.message);
      return NextResponse.redirect(loginUrl);
    }

    // Determine the exact origin (accounting for Vercel/reverse proxies)
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || (requestUrl.protocol ? requestUrl.protocol.replace(':', '') : 'https');
    const redirectBase = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin;

    // Successfully exchanged code or verified token for session
    const response = NextResponse.redirect(new URL(safeNext, redirectBase));

    // Synchronize cookies to response for complete reliability
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieStore.getAll().forEach(({ name, value }) => {
      response.cookies.set(name, value);
    });

    // Clear guest mode cookies if user explicitly signed into an account
    response.cookies.delete('lifemap_guest');
    response.cookies.delete('notenest_guest');

    return response;
  }

  // No code or error provided; return to login
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || (requestUrl.protocol ? requestUrl.protocol.replace(':', '') : 'https');
  const redirectBase = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;
  return NextResponse.redirect(new URL('/auth/login', redirectBase));
}
