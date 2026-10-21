'use client';

import { useAppStore } from '@/store/app-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function SettingsView() {
  const { theme, setTheme, userEmail, userId, userName, userAvatar, isGuest, setUser } = useAppStore();
  const router = useRouter();
  const supabase = createClient();

  const isLocalMode = isGuest || !userId || userId === 'local';

  async function handleSignOut() {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setUser(null, null);
      if (typeof document !== 'undefined') {
        document.cookie = 'lifemap_guest=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'notenest_guest=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      toast.success('Signed out successfully');
      router.push('/auth/login');
    } catch (err: unknown) {
      toast.error('Sign out encountered an issue');
      router.push('/auth/login');
    }
  }

  function handleSignIn() {
    router.push('/auth/login?next=/app');
  }

  async function handleExport() {
    // Build a JSON export of all local data
    const { getLocalDB } = await import('@/lib/db/local');
    const db = getLocalDB();

    const [notes, tasks, folders, tags] = await Promise.all([
      db.notes.toArray(),
      db.tasks.toArray(),
      db.folders.toArray(),
      db.tags.toArray(),
    ]);

    const bundle = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      user_email: userEmail,
      notes: notes.filter((n) => n.status !== 'deleted'),
      tasks: tasks.filter((t) => !t.is_deleted),
      folders,
      tags,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notenest-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported successfully!');
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', letterSpacing: '-0.02em', marginBottom: 'var(--space-8)', color: 'var(--text-primary)' }}>
          Settings
        </h1>

        {/* Account Section */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>
            Account & Security
          </h2>
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            {!isLocalMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {userAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={userAvatar}
                        alt={userName || 'User avatar'}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid var(--color-brand-100, #dbeafe)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'var(--font-weight-bold)',
                          fontSize: 'var(--font-size-lg)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {(userName || userEmail || 'U').charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                        {userName || userEmail?.split('@')[0]}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        {userEmail}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-brand-50, #eff6ff)', border: '1px solid var(--color-brand-200, #bfdbfe)', fontSize: 11, color: 'var(--color-brand-700, #1d4ed8)', fontWeight: 500 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                        Google Account
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleSignOut}
                    id="settings-sign-out-btn"
                    title="Sign out of your NoteNest account"
                  >
                    Sign out
                  </button>
                </div>
                {userId && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                    User ID: <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{userId}</code>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--bg-tertiary, #f1f5f9)',
                        color: 'var(--text-secondary, #475569)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M10 2a5 5 0 0 0-5 5v3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H7V7z" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                        Local Offline Account
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                        All notes, tasks, folders, and tags stay on this device.
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSignIn}
                    id="settings-sign-in-btn"
                  >
                    Sign in with Google
                  </button>
                </div>

                {!isSupabaseConfigured() && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <strong>Note:</strong> Supabase credentials are not configured in <code>.env.local</code>. Once configured, Google authentication and cloud sync will activate automatically.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Appearance */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>
            Appearance
          </h2>
          <div className="card">
            <div className="form-group">
              <label className="form-label" htmlFor="theme-select">Theme</label>
              <select
                id="theme-select"
                className="form-input"
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                style={{ maxWidth: 200 }}
              >
                <option value="system">System (auto)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </section>

        {/* AI */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>
            AI Assistant
          </h2>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              AI features require an OpenAI API key. Your note content is sent to OpenAI only when you trigger an AI operation.
              <br />
              <strong style={{ color: 'var(--text-primary)' }}>Original content is never replaced automatically.</strong>
              <br /><br />
              Add <code style={{ background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 2, fontSize: 'var(--font-size-xs)' }}>OPENAI_API_KEY=your-key</code> to your <code style={{ background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 2, fontSize: 'var(--font-size-xs)' }}>.env.local</code> file to enable AI.
            </div>
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: process.env.NEXT_PUBLIC_AI_CONFIGURED === 'true' ? 'var(--color-success)' : 'var(--color-neutral-300)',
                }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                AI is not configured (add OPENAI_API_KEY to .env.local)
              </span>
            </div>
          </div>
        </section>

        {/* Data */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>
            Data & Privacy
          </h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Export your data</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
                Download all your notes, tasks, and data as a JSON file. Your data, your ownership.
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleExport} id="export-data-btn">
                Export as JSON
              </button>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Privacy</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
                Your notes are stored locally on this device first. When sync is enabled, notes are stored in your personal Supabase database that you control.
                AI operations only process the specific note you request and use your own API key.
                We do not collect analytics about note contents.
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>
            About
          </h2>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
              <div><strong>FlowNote AI</strong> — Local-first notes and productivity</div>
              <div>Version 0.1.0 · Phase 1</div>
              <div>Built with Next.js 14, TipTap, Dexie, Supabase, Zustand</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
