'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { createClient } from '@/lib/supabase/client';
import { startSyncWorker, onSyncStatus, triggerSyncNow } from '@/lib/services/sync-worker';
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
      setUser('local', 'guest@notenest.local', { isGuest: true, name: 'Local Guest' });
      return;
    }

    // Helper to migrate any offline/local notes and tasks to authenticated user
    async function migrateLocalDataToUser(authenticatedUserId: string) {
      if (!authenticatedUserId || authenticatedUserId === 'local') return;
      try {
        const { getLocalDB } = await import('@/lib/db/local');
        const { queueSync } = await import('@/lib/services/sync-queue');
        const db = getLocalDB();

        const localNotes = await db.notes.where('user_id').equals('local').toArray();
        for (const note of localNotes) {
          if (note.id === 'DRAFT_NOTE') continue;
          const updated = { ...note, user_id: authenticatedUserId, sync_status: 'pending' as const };
          await db.notes.put(updated);
          await queueSync('note', note.id, 'create', updated);
        }

        const localTasks = await db.tasks.where('user_id').equals('local').toArray();
        for (const task of localTasks) {
          const updated = { ...task, user_id: authenticatedUserId, sync_status: 'pending' as const };
          await db.tasks.put(updated);
          await queueSync('task', task.id, 'create', updated);
        }

        const localFolders = await db.folders.where('user_id').equals('local').toArray();
        for (const folder of localFolders) {
          const updated = { ...folder, user_id: authenticatedUserId, sync_status: 'pending' as const };
          await db.folders.put(updated);
          await queueSync('folder', folder.id, 'create', updated);
        }
      } catch (err) {
        console.warn('[AppShell] Local data migration error:', err);
      }
    }

    // Inspect initial user session
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const name = (user.user_metadata?.full_name as string) ||
                     (user.user_metadata?.name as string) ||
                     (user.email ? user.email.split('@')[0] : 'User');
        const avatar = (user.user_metadata?.avatar_url as string) || null;
        setUser(user.id, user.email ?? null, { name, avatar, isGuest: false });
        await migrateLocalDataToUser(user.id);
        triggerSyncNow();
      } else {
        const isGuest =
          typeof document !== 'undefined' &&
          (document.cookie.includes('lifemap_guest=1') || document.cookie.includes('notenest_guest=1'));
        if (isGuest) {
          setUser('local', 'guest@lifemap.local', { isGuest: true, name: 'Guest User' });
        } else {
          setUser(null, null);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const u = session.user;
        const name = (u.user_metadata?.full_name as string) ||
                     (u.user_metadata?.name as string) ||
                     (u.email ? u.email.split('@')[0] : 'User');
        const avatar = (u.user_metadata?.avatar_url as string) || null;
        setUser(u.id, u.email ?? null, { name, avatar, isGuest: false });
        await migrateLocalDataToUser(u.id);
        triggerSyncNow();
      } else if (event === 'SIGNED_OUT') {
        const isGuest =
          typeof document !== 'undefined' &&
          (document.cookie.includes('lifemap_guest=1') || document.cookie.includes('notenest_guest=1'));
        if (isGuest) {
          setUser('local', 'guest@lifemap.local', { isGuest: true, name: 'Guest User' });
        } else {
          setUser(null, null);
        }
      }
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
