'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  isSupabaseConfigured,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPasswordForEmail,
} from '@/lib/supabase/client';
import { getSafeReturnUrl } from '@/lib/auth/url';

type AuthMode = 'signin' | 'signup' | 'forgot';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextParam = searchParams.get('next');
  const errorParam = searchParams.get('error');

  const safeReturnUrl = getSafeReturnUrl(nextParam, '/app');

  const [mode, setMode] = useState<AuthMode>('signin');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(errorParam);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
    if (errorParam) {
      setErrorMessage(errorParam);
    }
  }, [errorParam]);

  // Google OAuth flow
  async function handleGoogleSignIn() {
    setOauthLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await signInWithGoogle(safeReturnUrl);
      if (error) {
        setErrorMessage(error.message);
        setOauthLoading(false);
      }
      // If successful, the browser will redirect to Google's consent screen.
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred during Google sign-in.'
      );
      setOauthLoading(false);
    }
  }

  // Email Sign In
  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await signInWithEmail(email, password);
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Clear guest cookies
        if (typeof document !== 'undefined') {
          document.cookie = 'lifemap_guest=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'notenest_guest=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        router.push(safeReturnUrl);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign in failed.');
      setLoading(false);
    }
  }

  // Email Sign Up
  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await signUpWithEmail(email, password, displayName, safeReturnUrl);
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Check if user session was immediately established or email confirmation is required
      if (data.session) {
        if (typeof document !== 'undefined') {
          document.cookie = 'lifemap_guest=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'notenest_guest=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        router.push(safeReturnUrl);
      } else {
        setLoading(false);
        setSuccessMessage('Account created! A confirmation link has been sent to your email address.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
      setLoading(false);
    }
  }

  // Forgot Password
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your email address to receive a recovery link.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await resetPasswordForEmail(email, '/auth/reset-password');
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      setLoading(false);
      setSuccessMessage('Password reset link sent! Please check your email inbox.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Password reset request failed.');
      setLoading(false);
    }
  }

  // Guest / Offline Mode
  function handleContinueGuest() {
    if (typeof document !== 'undefined') {
      document.cookie = 'lifemap_guest=1; path=/; max-age=31536000; SameSite=Lax';
      document.cookie = 'notenest_guest=1; path=/; max-age=31536000; SameSite=Lax';
    }
    router.push(safeReturnUrl);
  }

  return (
    <div className="auth-split-viewport">
      <div className="auth-split-container">
        {/* ─── LEFT: Brand & Value Visualization ────────────────────────── */}
        <section className="auth-hero-pane" aria-labelledby="brand-title">
          <div className="auth-brand-badge">
            <div className="auth-brand-logo-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="rgba(255,255,255,0.2)" />
              </svg>
            </div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#c7d2fe', letterSpacing: '0.02em' }}>
              LifeMap OS 2.0
            </span>
          </div>

          <h1 id="brand-title" className="auth-hero-title">
            Your life. Your goals. <br />
            <span className="auth-hero-gradient-text">In sync.</span>
          </h1>

          <p className="auth-hero-desc">
            The intelligent operating system designed to connect long-term vision with daily execution. Streamline your tasks, roadmaps, and reflections in one unified workspace.
          </p>

          {/* Interactive Productivity Overview Mockup */}
          <div className="auth-preview-card" aria-hidden="true">
            <div className="auth-preview-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f1f5f9' }}>
                  Weekly Momentum
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>
                76% Achieved
              </span>
            </div>

            <div className="auth-preview-progress-bar">
              <div className="auth-preview-progress-fill" />
            </div>

            <div className="auth-preview-stream-list">
              <div className="auth-preview-stream-pill">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                <span>Technical Architecture</span>
              </div>
              <div className="auth-preview-stream-pill">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }} />
                <span>Strategic Roadmap</span>
              </div>
              <div className="auth-preview-stream-pill">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />
                <span>Daily Deep Work</span>
              </div>
              <div className="auth-preview-stream-pill">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                <span>Weekly Review</span>
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="auth-preview-features">
            <div className="auth-feature-tag">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#818cf8" strokeWidth="2">
                <path d="M10 2a5 5 0 0 0-5 5v3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H7V7z" />
              </svg>
              <span>Encrypted Storage</span>
            </div>
            <div className="auth-feature-tag">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#818cf8" strokeWidth="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Instant Offline Sync</span>
            </div>
            <div className="auth-feature-tag">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#818cf8" strokeWidth="2">
                <circle cx="10" cy="10" r="7" />
                <path d="M7 10l2 2 4-4" />
              </svg>
              <span>Zero Vendor Lock-in</span>
            </div>
          </div>
        </section>

        {/* ─── RIGHT: Authentication Card ───────────────────────────────── */}
        <section className="auth-form-pane">
          <div className="auth-form-card">
            {/* Header / Mode Switcher */}
            {mode !== 'forgot' ? (
              <div className="auth-tabs" role="tablist" aria-label="Authentication Options">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  id="tab-sign-in"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signup'}
                  className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  id="tab-sign-up"
                >
                  Create Account
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#818cf8',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  ← Back to Sign In
                </button>
              </div>
            )}

            {/* Mode Titles */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
                {mode === 'signin' && 'Welcome back.'}
                {mode === 'signup' && 'Create your account.'}
                {mode === 'forgot' && 'Reset your password.'}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '6px' }}>
                {mode === 'signin' && 'Sign in to continue your journey.'}
                {mode === 'signup' && 'Start organizing your life and goals with clarity.'}
                {mode === 'forgot' && "Enter your email and we'll send you a recovery link."}
              </p>
            </div>

            {/* Supabase Unconfigured Warning Notice */}
            {!configured && (
              <div
                role="status"
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '20px',
                  fontSize: '0.8125rem',
                  color: '#93c5fd',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="10" cy="10" r="8" />
                    <line x1="10" y1="8" x2="10" y2="12" />
                    <line x1="10" y1="15" x2="10.01" y2="15" />
                  </svg>
                  <div>
                    <strong style={{ color: '#dbeafe' }}>Supabase not yet configured</strong>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#bfdbfe' }}>
                      Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>. You can immediately use LifeMap OS in offline guest mode below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#f87171" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="10" cy="10" r="8" />
                    <line x1="10" y1="6" x2="10" y2="10" />
                    <line x1="10" y1="14" x2="10.01" y2="14" />
                  </svg>
                  <span style={{ fontSize: '0.8125rem', color: '#fca5a5', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {errorMessage}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  aria-label="Dismiss error"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Success Message Banner */}
            {successMessage && (
              <div
                role="status"
                style={{
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#4ade80" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="10" cy="10" r="8" />
                  <path d="M6 10l3 3 5-5" />
                </svg>
                <span style={{ fontSize: '0.8125rem', color: '#86efac', lineHeight: 1.4 }}>
                  {successMessage}
                </span>
              </div>
            )}

            {/* Google OAuth (Available on Sign In and Sign Up modes) */}
            {mode !== 'forgot' && (
              <>
                <button
                  id="google-signin-btn"
                  type="button"
                  className="auth-google-btn"
                  onClick={handleGoogleSignIn}
                  disabled={oauthLoading || loading}
                  aria-busy={oauthLoading}
                >
                  {oauthLoading ? (
                    <>
                      <span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#0f172a' }} />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <div className="auth-divider">
                  <div className="auth-divider-line" />
                  <span className="auth-divider-text">or continue with email</span>
                  <div className="auth-divider-line" />
                </div>
              </>
            )}

            {/* Email Forms */}
            {mode === 'signin' && (
              <form onSubmit={handleEmailSignIn} noValidate>
                <div className="auth-input-group">
                  <label htmlFor="signin-email" className="auth-label">
                    Email address
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="auth-input"
                    disabled={loading || oauthLoading}
                  />
                </div>

                <div className="auth-input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label htmlFor="signin-password" className="auth-label" style={{ margin: 0 }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#818cf8',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      id="forgot-password-link"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="auth-input-wrapper">
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="auth-input"
                      style={{ paddingRight: '40px' }}
                      disabled={loading || oauthLoading}
                    />
                    <button
                      type="button"
                      className="auth-input-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  id="email-signin-btn"
                  type="submit"
                  className="auth-primary-btn"
                  disabled={loading || oauthLoading}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign in to LifeMap OS</span>
                  )}
                </button>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleEmailSignUp} noValidate>
                <div className="auth-input-group">
                  <label htmlFor="signup-name" className="auth-label">
                    Full name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="auth-input"
                    disabled={loading || oauthLoading}
                  />
                </div>

                <div className="auth-input-group">
                  <label htmlFor="signup-email" className="auth-label">
                    Email address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="auth-input"
                    disabled={loading || oauthLoading}
                  />
                </div>

                <div className="auth-input-group">
                  <label htmlFor="signup-password" className="auth-label">
                    Password (min. 6 characters)
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="auth-input"
                      style={{ paddingRight: '40px' }}
                      disabled={loading || oauthLoading}
                    />
                    <button
                      type="button"
                      className="auth-input-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="auth-input-group">
                  <label htmlFor="signup-confirm-password" className="auth-label">
                    Confirm Password
                  </label>
                  <input
                    id="signup-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="auth-input"
                    disabled={loading || oauthLoading}
                  />
                </div>

                <button
                  id="email-signup-btn"
                  type="submit"
                  className="auth-primary-btn"
                  disabled={loading || oauthLoading}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Create Free Account</span>
                  )}
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} noValidate>
                <div className="auth-input-group">
                  <label htmlFor="forgot-email" className="auth-label">
                    Your account email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="auth-input"
                    disabled={loading || oauthLoading}
                  />
                </div>

                <button
                  id="reset-password-btn"
                  type="submit"
                  className="auth-primary-btn"
                  disabled={loading || oauthLoading}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    <span>Send Reset Instructions</span>
                  )}
                </button>
              </form>
            )}

            {/* Offline Guest Option */}
            <button
              id="guest-mode-btn"
              type="button"
              className="auth-guest-btn"
              onClick={handleContinueGuest}
              disabled={loading || oauthLoading}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M10 2a5 5 0 0 0-5 5v3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H7V7z" />
              </svg>
              <span>Continue as Guest (Offline Mode)</span>
            </button>

            {/* Footer switcher note */}
            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.8125rem', color: '#64748b' }}>
              {mode === 'signin' && (
                <span>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Create one
                  </button>
                </span>
              )}
              {mode === 'signup' && (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-split-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
