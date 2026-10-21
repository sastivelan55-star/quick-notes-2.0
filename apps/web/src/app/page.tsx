import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect('/app');
    }

    const cookieStore = await cookies();
    const isGuest =
      cookieStore.get('lifemap_guest')?.value === '1' ||
      cookieStore.get('notenest_guest')?.value === '1';
    if (isGuest) {
      redirect('/app');
    }

    redirect('/auth/login');
  }

  // If Supabase is not configured, proceed directly to app in local-only mode
  redirect('/app');
}
