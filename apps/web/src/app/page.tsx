import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect('/app');
    } else {
      redirect('/auth/login');
    }
  }

  // If Supabase is not configured, go to app in local-only mode
  redirect('/app');
}
