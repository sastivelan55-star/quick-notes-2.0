'use client';

import { useAppStore } from '@/store/app-store';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function SettingsView() {
  const { theme, setTheme, userEmail, userId } = useAppStore();
  const router = useRouter();
  const supabase = createClient();

  const isLocalMode = userEmail === 'local@flownote.local';

  async function handleSignOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push('/auth/login');
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
    a.download = `flownote-export-${new Date().toISOString().split('T')[0]}.json`;
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

        {/* Account */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>
            Account
          </h2>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                  {isLocalMode ? 'Local Mode' : userEmail}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {isLocalMode
                    ? 'Notes are saved only on this device. Configure Supabase to sync across devices.'
                    : 'Signed in with Supabase. Notes sync across your devices.'}
                </div>
              </div>
              {!isLocalMode && (
                <button className="btn btn-secondary btn-sm" onClick={handleSignOut} id="settings-sign-out-btn">
                  Sign out
                </button>
              )}
            </div>
            {isLocalMode && (
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                To enable sync, add your Supabase credentials to <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 2 }}>.env.local</code> and restart the server.
                See <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-brand)' }}>supabase.com</a> to create a free project.
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
