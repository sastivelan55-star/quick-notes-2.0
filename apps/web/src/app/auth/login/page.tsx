'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isLocalMode = !supabase;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      // Local-only mode: skip auth, go straight to app
      router.push('/app');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/app');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
        setMessage('Check your email for a confirmation link!');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!supabase || !email) {
      setError('Please enter your email first');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    if (error) setError(error.message);
    else setMessage('Magic link sent! Check your email.');
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M6 4h10l6 6v14H6V4z" fill="white" fillOpacity="0.9"/>
              <path d="M16 4l6 6h-6V4z" fill="white" fillOpacity="0.5"/>
              <path d="M9 12h10M9 16h7M9 20h5" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="auth-title">FlowNote AI</h1>
          <p className="auth-subtitle">
            {isLocalMode
              ? 'Running in local mode — your notes stay on this device'
              : mode === 'login'
              ? 'Welcome back. Sign in to continue.'
              : 'Create your account to get started.'}
          </p>
        </div>

        {isLocalMode ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                background: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-6)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-warning)',
              }}
            >
              <strong>Supabase not configured.</strong> Your notes will be saved locally on this device only.
              <br />
              <span style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Add your credentials to <code>.env.local</code> to enable sync.
              </span>
            </div>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={() => router.push('/app')}
            >
              Open FlowNote (Local Mode)
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="form-label" htmlFor="display-name">Your name</label>
                  <input
                    id="display-name"
                    className="form-input"
                    type="text"
                    placeholder="Jane Smith"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="form-input"
                  type="password"
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {error && (
                <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>
                  {error}
                </div>
              )}

              {message && (
                <div
                  style={{
                    color: 'var(--color-success)',
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginBottom: 'var(--space-3)' }}
                disabled={loading}
                id="auth-submit-btn"
              >
                {loading ? (
                  <span className="spinner" />
                ) : mode === 'login' ? (
                  'Sign in'
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            {mode === 'login' && (
              <button
                className="btn btn-secondary btn-lg"
                style={{ width: '100%', marginBottom: 'var(--space-6)' }}
                onClick={handleMagicLink}
                disabled={loading}
                id="magic-link-btn"
              >
                Send magic link
              </button>
            )}

            <p
              style={{
                textAlign: 'center',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline' }}
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError('');
                  setMessage('');
                }}
                id="auth-toggle-mode-btn"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
