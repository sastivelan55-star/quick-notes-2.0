'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { createClient } from '@/lib/supabase/client';
import { startSyncWorker, onSyncStatus } from '@/lib/services/sync-worker';
import { getQueueSize } from '@/lib/services/sync-queue';
import Sidebar from './Sidebar';
import OfflineBanner from './OfflineBanner';
import CommandPalette from './CommandPalette';
import MobileNav from './MobileNav';
import { Toaster } from 'react-hot-toast';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const {
    setUser,
    setSyncStatus,
    setPendingSyncCount,
    theme,
  } = useAppStore();

  // ─── Theme effect ─────────────────────────────────────────────
  useEffect(() => {
    function applyTheme(t: string) {
      const resolved =
        t === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : t;
      document.documentElement.setAttribute('data-theme', resolved);
    }

    applyTheme(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  // ─── Auth + User ──────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setUser('local', 'local@flownote.local');
      return;
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user.id, user.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user?.id ?? null, session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  // ─── Sync Worker ─────────────────────────────────────────────
  const updatePendingCount = useCallback(async () => {
    const count = await getQueueSize();
    setPendingSyncCount(count);
  }, [setPendingSyncCount]);

  useEffect(() => {
    startSyncWorker();

    const unsub = onSyncStatus((status) => {
      setSyncStatus(status);
      updatePendingCount();
    });

    updatePendingCount();

    return () => {
      unsub();
    };
  }, [setSyncStatus, updatePendingCount]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="workspace">
        <MobileNav />
        <OfflineBanner />
        <main className="workspace-content" id="main-content" role="main">
          {children}
        </main>
      </div>
      <CommandPalette />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 'var(--font-size-sm)',
          },
        }}
      />
    </div>
  );
}
