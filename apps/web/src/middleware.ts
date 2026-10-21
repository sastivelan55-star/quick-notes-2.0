import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSafeReturnUrl } from '@/lib/auth/url';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured =
    url &&
    key &&
    url !== 'https://your-project.supabase.co' &&
    !url.includes('your-project') &&
    key !== 'your-anon-key-here' &&
    !key.includes('your-anon-key');

  // If Supabase is not configured, allow local-only guest mode through to /app
  if (!isConfigured) {
    return NextResponse.next();
  }

  // Never intercept OAuth callback handler or password reset page
  if (
    request.nextUrl.pathname.startsWith('/auth/callback') ||
    request.nextUrl.pathname.startsWith('/auth/reset-password')
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isGuest =
    request.cookies.get('lifemap_guest')?.value === '1' ||
    request.cookies.get('notenest_guest')?.value === '1';

  // Protect /app routes for unauthenticated users unless guest mode is active
  if (!user && !isGuest && request.nextUrl.pathname.startsWith('/app')) {
    const loginUrl = new URL('/auth/login', request.url);
    const returnPath = request.nextUrl.pathname + request.nextUrl.search;
    loginUrl.searchParams.set('next', returnPath);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from /auth/login
  if (user && request.nextUrl.pathname === '/auth/login') {
    const nextParam = request.nextUrl.searchParams.get('next');
    const safeTarget = getSafeReturnUrl(nextParam, '/app');
    return NextResponse.redirect(new URL(safeTarget, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
