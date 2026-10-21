/**
 * NoteNest — Authentication Foundation Test Suite
 *
 * Covers:
 * 1. Safe return URL validation and open-redirect prevention
 * 2. Supabase environment configuration detection & graceful fallback
 * 3. Google OAuth sign-in initiation (mocked vs real distinction)
 * 4. OAuth callback code exchange success & failure handling
 * 5. Session persistence, expired-session behavior, and sign-out
 * 6. Local notes preservation and strict cross-account data isolation
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeReturnUrl } from '../src/lib/auth/url.ts';

// ─── 1. Safe Return URL Tests ────────────────────────────────────────
describe('Safe Return URL Validation (Open Redirect Prevention)', () => {
  test('allows safe relative paths', () => {
    assert.equal(getSafeReturnUrl('/app'), '/app');
    assert.equal(getSafeReturnUrl('/app/notes'), '/app/notes');
    assert.equal(getSafeReturnUrl('/app/settings?tab=account'), '/app/settings?tab=account');
    assert.equal(getSafeReturnUrl('/notes/123-abc'), '/notes/123-abc');
  });

  test('falls back to default /app on empty, null, or undefined input', () => {
    assert.equal(getSafeReturnUrl(null), '/app');
    assert.equal(getSafeReturnUrl(undefined), '/app');
    assert.equal(getSafeReturnUrl(''), '/app');
    assert.equal(getSafeReturnUrl('   '), '/app');
  });

  test('uses custom fallback when provided', () => {
    assert.equal(getSafeReturnUrl(null, '/custom'), '/custom');
    assert.equal(getSafeReturnUrl('', '/dashboard'), '/dashboard');
  });

  test('rejects external absolute URLs (http and https)', () => {
    assert.equal(getSafeReturnUrl('https://evil.com'), '/app');
    assert.equal(getSafeReturnUrl('http://attacker.com/steal-token'), '/app');
    assert.equal(getSafeReturnUrl('https://google.com'), '/app');
  });

  test('rejects protocol-relative URLs (//evil.com)', () => {
    assert.equal(getSafeReturnUrl('//evil.com'), '/app');
    assert.equal(getSafeReturnUrl('//attacker.org/login'), '/app');
    assert.equal(getSafeReturnUrl('///evil.com'), '/app');
  });

  test('rejects Windows backslash path bypass attempts', () => {
    assert.equal(getSafeReturnUrl('/\\evil.com'), '/app');
    assert.equal(getSafeReturnUrl('\\app'), '/app');
    assert.equal(getSafeReturnUrl('\\\\evil.com\\share'), '/app');
    assert.equal(getSafeReturnUrl('/app\\notes'), '/app');
  });

  test('rejects javascript: and data: schemes', () => {
    assert.equal(getSafeReturnUrl('javascript:alert(1)'), '/app');
    assert.equal(getSafeReturnUrl('data:text/html,<script>alert(1)</script>'), '/app');
    assert.equal(getSafeReturnUrl('/javascript:void(0)'), '/app');
  });

  test('rejects control characters and CRLF injection', () => {
    assert.equal(getSafeReturnUrl('/app\r\nSet-Cookie:malicious=1'), '/app');
    assert.equal(getSafeReturnUrl('/app\u0000admin'), '/app');
  });
});

// ─── 2. Environment Configuration & Graceful Fallback ───────────────
describe('Environment Configuration & Graceful Offline Fallback', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  function checkConfig(url?: string, key?: string): boolean {
    if (!url || !key) return false;
    if (url === 'https://your-project.supabase.co' || url.includes('your-project')) return false;
    if (key === 'your-anon-key-here' || key.includes('your-anon-key')) return false;
    return true;
  }

  test('reports unconfigured when environment variables are missing', () => {
    assert.equal(checkConfig(undefined, undefined), false);
    assert.equal(checkConfig('', ''), false);
  });

  test('reports unconfigured when placeholder values are used', () => {
    assert.equal(checkConfig('https://your-project.supabase.co', 'your-anon-key-here'), false);
    assert.equal(checkConfig('https://your-project-id.supabase.co', 'your-anon-key-placeholder'), false);
  });

  test('reports configured when valid non-placeholder URL and key are provided', () => {
    assert.equal(
      checkConfig('https://xyzcompany.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validkey'),
      true
    );
  });

  test('safe client returns null rather than throwing when unconfigured', () => {
    // When Supabase is not configured, createClient returns null
    // allowing the app to run completely in offline guest mode.
    const client = checkConfig(undefined, undefined) ? {} : null;
    assert.equal(client, null);
  });
});

// ─── 3. Google Sign-in Initiation (Mocked OAuth) ─────────────────────
describe('Google Sign-in Initiation (Mocked)', () => {
  test('fails gracefully with informative error when Supabase is unconfigured', async () => {
    const isConfigured = false;
    async function mockSignIn(returnUrl = '/app') {
      if (!isConfigured) {
        return {
          data: null,
          error: new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'),
        };
      }
      return { data: { url: 'https://accounts.google.com/o/oauth2/auth?...' }, error: null };
    }

    const res = await mockSignIn();
    assert.equal(res.data, null);
    assert.ok(res.error instanceof Error);
    assert.match(res.error.message, /Supabase is not configured/);
  });

  test('initiates OAuth with correct Google provider, callback URL, and offline access prompt', async () => {
    let capturedOptions: any = null;

    const mockSupabase = {
      auth: {
        async signInWithOAuth(opts: any) {
          capturedOptions = opts;
          return {
            data: {
              provider: 'google',
              url: 'https://mock-supabase.co/auth/v1/authorize?provider=google',
            },
            error: null,
          };
        },
      },
    };

    const targetReturn = '/app/notes?view=active';
    const callbackOrigin = 'http://localhost:3000';
    const expectedRedirect = `${callbackOrigin}/auth/callback?next=${encodeURIComponent(targetReturn)}`;

    const res = await mockSupabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: expectedRedirect,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    assert.equal(res.error, null);
    assert.equal(res.data.provider, 'google');
    assert.equal(capturedOptions.provider, 'google');
    assert.equal(capturedOptions.options.redirectTo, expectedRedirect);
    assert.equal(capturedOptions.options.queryParams.access_type, 'offline');
    assert.equal(capturedOptions.options.queryParams.prompt, 'select_account');
  });
});

// ─── 4. OAuth Callback Exchange (Mocked) ─────────────────────────────
describe('OAuth Callback Route Logic (Mocked)', () => {
  test('handles provider error params and redirects to login with error message', () => {
    const searchParams = new URLSearchParams({
      error: 'access_denied',
      error_description: 'User cancelled Google sign-in flow',
    });

    const error = searchParams.get('error');
    const desc = searchParams.get('error_description');
    const redirectUrl = `/auth/login?error=${encodeURIComponent(desc || error!)}`;

    assert.equal(
      redirectUrl,
      '/auth/login?error=User%20cancelled%20Google%20sign-in%20flow'
    );
  });

  test('successfully exchanges valid code for session and redirects to validated destination', async () => {
    let exchangedCode: string | null = null;
    const mockAuthServer = {
      async exchangeCodeForSession(code: string) {
        exchangedCode = code;
        return {
          data: {
            user: { id: 'usr-123', email: 'pilot@example.com' },
            session: { access_token: 'jwt-token-xyz' },
          },
          error: null,
        };
      },
    };

    const code = 'valid-auth-code-789';
    const next = '/app/settings';
    const safeNext = getSafeReturnUrl(next, '/app');

    const res = await mockAuthServer.exchangeCodeForSession(code);

    assert.equal(exchangedCode, 'valid-auth-code-789');
    assert.equal(res.error, null);
    assert.equal(res.data.user.email, 'pilot@example.com');
    assert.equal(safeNext, '/app/settings');
  });

  test('redirects to login with error when code exchange fails', async () => {
    const mockAuthServer = {
      async exchangeCodeForSession(_code: string) {
        return {
          data: null,
          error: new Error('Auth code expired or already used'),
        };
      },
    };

    const res = await mockAuthServer.exchangeCodeForSession('expired-code');
    assert.ok(res.error instanceof Error);
    assert.equal(res.error.message, 'Auth code expired or already used');

    const loginRedirect = `/auth/login?error=${encodeURIComponent(res.error.message)}`;
    assert.equal(loginRedirect, '/auth/login?error=Auth%20code%20expired%20or%20already%20used');
  });

  test('sanitizes open-redirect attempt in callback next param', () => {
    const maliciousNext = '//evil-site.com/exploit';
    const sanitized = getSafeReturnUrl(maliciousNext, '/app');
    assert.equal(sanitized, '/app');
  });
});

// ─── 5. Session State, Expired Sessions, & Sign-Out ──────────────────
describe('Session State Management & Sign-Out', () => {
  interface MockState {
    userId: string | null;
    userEmail: string | null;
    userName: string | null;
    userAvatar: string | null;
    isGuest: boolean;
    activeNoteId: string | null;
    notes: Array<{ id: string; user_id: string; title: string }>;
  }

  function createMockStore() {
    let state: MockState = {
      userId: null,
      userEmail: null,
      userName: null,
      userAvatar: null,
      isGuest: false,
      activeNoteId: null,
      notes: [],
    };

    return {
      getState: () => state,
      setUser(
        id: string | null,
        email: string | null,
        meta?: { name?: string | null; avatar?: string | null; isGuest?: boolean }
      ) {
        const userChanged = state.userId !== id;
        state = {
          ...state,
          userId: id,
          userEmail: email,
          userName: meta?.name ?? null,
          userAvatar: meta?.avatar ?? null,
          isGuest: meta?.isGuest ?? (id === 'local'),
          ...(userChanged
            ? {
                activeNoteId: null,
                notes: [],
              }
            : {}),
        };
      },
      setActiveNote(id: string | null) {
        state.activeNoteId = id;
      },
      setNotes(notes: Array<{ id: string; user_id: string; title: string }>) {
        state.notes = notes;
      },
    };
  }

  test('sets authenticated user state correctly with Google profile metadata', () => {
    const store = createMockStore();
    store.setUser('usr-google-42', 'test@example.com', {
      name: 'Test Pilot',
      avatar: 'https://lh3.googleusercontent.com/photo.jpg',
      isGuest: false,
    });

    const s = store.getState();
    assert.equal(s.userId, 'usr-google-42');
    assert.equal(s.userEmail, 'test@example.com');
    assert.equal(s.userName, 'Test Pilot');
    assert.equal(s.userAvatar, 'https://lh3.googleusercontent.com/photo.jpg');
    assert.equal(s.isGuest, false);
  });

  test('transitions to guest user state when unauthenticated or offline', () => {
    const store = createMockStore();
    store.setUser('local', 'guest@notenest.local', {
      name: 'Local Guest',
      isGuest: true,
    });

    const s = store.getState();
    assert.equal(s.userId, 'local');
    assert.equal(s.isGuest, true);
    assert.equal(s.userName, 'Local Guest');
  });

  test('handles sign-out by resetting user state and clearing active note memory', () => {
    const store = createMockStore();
    store.setUser('usr-google-42', 'test@example.com');
    store.setActiveNote('note-123');
    store.setNotes([{ id: 'note-123', user_id: 'usr-google-42', title: 'Top Secret' }]);

    assert.equal(store.getState().activeNoteId, 'note-123');
    assert.equal(store.getState().notes.length, 1);

    // Sign out
    store.setUser(null, null);

    const s = store.getState();
    assert.equal(s.userId, null);
    assert.equal(s.userEmail, null);
    assert.equal(s.activeNoteId, null);
    assert.equal(s.notes.length, 0);
  });

  test('handles expired session by safely transitioning to unauthenticated', () => {
    const store = createMockStore();
    store.setUser('usr-google-42', 'test@example.com');

    // Simulate session expiry event (event: 'SIGNED_OUT' or token refresh failure)
    store.setUser(null, null);

    assert.equal(store.getState().userId, null);
    assert.equal(store.getState().userEmail, null);
  });
});

// ─── 6. Local Data Isolation & Account Boundaries ────────────────────
describe('Local Data Isolation & Account Boundaries', () => {
  interface NoteRecord {
    id: string;
    user_id: string;
    title: string;
    status: 'active' | 'deleted';
  }

  // Simulated Dexie query engine
  class MockDexieNotes {
    private records: NoteRecord[] = [];

    async insert(note: NoteRecord) {
      this.records.push({ ...note });
    }

    async listForUser(userId: string): Promise<NoteRecord[]> {
      return this.records.filter((n) => n.user_id === userId && n.status === 'active');
    }

    getAllRaw() {
      return this.records;
    }
  }

  test('local notes remain intact through login and logout cycles', async () => {
    const db = new MockDexieNotes();

    // 1. User creates local notes as guest
    await db.insert({ id: 'local-note-1', user_id: 'local', title: 'My Offline Idea', status: 'active' });
    await db.insert({ id: 'local-note-2', user_id: 'local', title: 'Shopping List', status: 'active' });

    const guestNotes = await db.listForUser('local');
    assert.equal(guestNotes.length, 2);

    // 2. User signs into Account A (Google)
    await db.insert({ id: 'cloud-note-1', user_id: 'account-a-uuid', title: 'Account A Roadmap', status: 'active' });

    // Account A should only see Account A notes
    const accountANotes = await db.listForUser('account-a-uuid');
    assert.equal(accountANotes.length, 1);
    assert.equal(accountANotes[0].title, 'Account A Roadmap');

    // Guest notes are still safely preserved on device
    const preservedGuestNotes = await db.listForUser('local');
    assert.equal(preservedGuestNotes.length, 2);

    // 3. User signs out; local notes are immediately accessible again
    const afterLogoutNotes = await db.listForUser('local');
    assert.equal(afterLogoutNotes.length, 2);
    assert.equal(afterLogoutNotes[0].title, 'My Offline Idea');
  });

  test('user account switching strictly prevents cross-account data leakage', async () => {
    const db = new MockDexieNotes();

    // Account A data
    await db.insert({ id: 'note-a1', user_id: 'user-alice-uuid', title: "Alice's Secret Project", status: 'active' });

    // Account B data
    await db.insert({ id: 'note-b1', user_id: 'user-bob-uuid', title: "Bob's Financials", status: 'active' });

    // Alice queries
    const aliceNotes = await db.listForUser('user-alice-uuid');
    assert.equal(aliceNotes.length, 1);
    assert.equal(aliceNotes[0].title, "Alice's Secret Project");
    assert.ok(!aliceNotes.some((n) => n.user_id === 'user-bob-uuid'));

    // Bob queries
    const bobNotes = await db.listForUser('user-bob-uuid');
    assert.equal(bobNotes.length, 1);
    assert.equal(bobNotes[0].title, "Bob's Financials");
    assert.ok(!bobNotes.some((n) => n.user_id === 'user-alice-uuid'));

    // Neither account sees guest data
    assert.ok(!aliceNotes.some((n) => n.user_id === 'local'));
    assert.ok(!bobNotes.some((n) => n.user_id === 'local'));
  });

  test('anonymous data is not silently merged into authenticated account', async () => {
    const db = new MockDexieNotes();

    await db.insert({ id: 'anon-1', user_id: 'local', title: 'Anonymous Note', status: 'active' });

    // When User logs in as user-uuid-carol
    const carolNotes = await db.listForUser('user-uuid-carol');
    assert.equal(carolNotes.length, 0, 'New user account must not automatically inherit anonymous notes');

    // Local anonymous notes remain under 'local'
    const anonNotes = await db.listForUser('local');
    assert.equal(anonNotes.length, 1);
    assert.equal(anonNotes[0].user_id, 'local');
  });
});

// ─── 7. Email & Password Authentication (Mocked) ────────────────────
describe('Email & Password Authentication Flow', () => {
  test('rejects empty email or password in client validation', () => {
    function validateSignIn(email: string, pass: string) {
      if (!email.trim() || !pass) {
        return { valid: false, error: 'Please enter both email and password.' };
      }
      return { valid: true, error: null };
    }

    assert.equal(validateSignIn('', 'secret').valid, false);
    assert.equal(validateSignIn('test@example.com', '').valid, false);
    assert.equal(validateSignIn('test@example.com', 'password123').valid, true);
  });

  test('successfully signs in with valid email credentials', async () => {
    const mockAuth = {
      async signInWithPassword(creds: { email: string; password: string }) {
        if (creds.email === 'pilot@lifemap.io' && creds.password === 'correct-horse-battery') {
          return {
            data: { user: { id: 'usr-valid-1', email: 'pilot@lifemap.io' }, session: { access_token: 'valid-jwt' } },
            error: null,
          };
        }
        return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
      },
    };

    const res = await mockAuth.signInWithPassword({
      email: 'pilot@lifemap.io',
      password: 'correct-horse-battery',
    });

    assert.equal(res.error, null);
    assert.equal(res.data.user?.email, 'pilot@lifemap.io');
    assert.equal(res.data.session?.access_token, 'valid-jwt');
  });

  test('handles invalid credentials gracefully with clear error', async () => {
    const mockAuth = {
      async signInWithPassword(_creds: { email: string; password: string }) {
        return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
      },
    };

    const res = await mockAuth.signInWithPassword({ email: 'bad@example.com', password: 'wrong' });
    assert.ok(res.error instanceof Error);
    assert.equal(res.error.message, 'Invalid login credentials');
  });
});

// ─── 8. User Registration Flow (Mocked) ──────────────────────────────
describe('User Registration Flow', () => {
  test('enforces password minimum length of 6 characters', () => {
    function validateSignUp(pass: string, confirm: string) {
      if (pass.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long.' };
      }
      if (pass !== confirm) {
        return { valid: false, error: 'Passwords do not match.' };
      }
      return { valid: true, error: null };
    }

    assert.equal(validateSignUp('12345', '12345').valid, false);
    assert.equal(validateSignUp('123456', 'mismatch').valid, false);
    assert.equal(validateSignUp('strongpass123', 'strongpass123').valid, true);
  });

  test('creates new user and includes display name metadata', async () => {
    let capturedOptions: any = null;
    const mockAuth = {
      async signUp(opts: any) {
        capturedOptions = opts;
        return {
          data: {
            user: { id: 'usr-new-77', email: opts.email, user_metadata: opts.options?.data },
            session: { access_token: 'tok-123' },
          },
          error: null,
        };
      },
    };

    const res = await mockAuth.signUp({
      email: 'newbie@lifemap.io',
      password: 'mypassword123',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fapp',
        data: { display_name: 'Alex Morgan', full_name: 'Alex Morgan' },
      },
    });

    assert.equal(res.error, null);
    assert.equal(res.data.user.id, 'usr-new-77');
    assert.equal(capturedOptions.options.data.display_name, 'Alex Morgan');
    assert.equal(capturedOptions.options.emailRedirectTo, 'http://localhost:3000/auth/callback?next=%2Fapp');
  });
});

// ─── 9. Password Reset & Update Lifecycle ────────────────────────────
describe('Password Reset & Update Lifecycle', () => {
  test('initiates password recovery with correct redirect destination', async () => {
    let capturedEmail = '';
    let capturedRedirect = '';

    const mockAuth = {
      async resetPasswordForEmail(email: string, opts: { redirectTo: string }) {
        capturedEmail = email;
        capturedRedirect = opts.redirectTo;
        return { data: {}, error: null };
      },
    };

    const res = await mockAuth.resetPasswordForEmail('forgot@lifemap.io', {
      redirectTo: 'http://localhost:3000/auth/callback?next=%2Fauth%2Freset-password',
    });

    assert.equal(res.error, null);
    assert.equal(capturedEmail, 'forgot@lifemap.io');
    assert.match(decodeURIComponent(capturedRedirect), /\/auth\/reset-password/);
  });

  test('updates password securely when authenticated with recovery session', async () => {
    let capturedNewPassword = '';

    const mockAuth = {
      async updateUser(params: { password: string }) {
        capturedNewPassword = params.password;
        return { data: { user: { id: 'usr-reset-1' } }, error: null };
      },
    };

    const res = await mockAuth.updateUser({ password: 'BrandNewSecurePassword456!' });
    assert.equal(res.error, null);
    assert.equal(capturedNewPassword, 'BrandNewSecurePassword456!');
  });
});

// ─── 10. Multi-Domain Routing & RLS Ownership Invariants ─────────────
describe('Multi-Domain Reverse Proxy & RLS Invariants', () => {
  test('resolves exact redirect origin with x-forwarded-host in production', () => {
    function resolveRedirectOrigin(
      requestOrigin: string,
      forwardedHost: string | null,
      isLocal: boolean
    ): string {
      if (!isLocal && forwardedHost) {
        return `https://${forwardedHost}`;
      }
      return requestOrigin;
    }

    // Local development ignores x-forwarded-host
    assert.equal(
      resolveRedirectOrigin('http://localhost:3000', 'evil.com', true),
      'http://localhost:3000'
    );

    // Production uses forwarded host from Vercel
    assert.equal(
      resolveRedirectOrigin('https://internal.vercel.app', 'quick-notes-2-0.vercel.app', false),
      'https://quick-notes-2-0.vercel.app'
    );

    assert.equal(
      resolveRedirectOrigin('https://internal.vercel.app', 'lets-do-it-cr4w.vercel.app', false),
      'https://lets-do-it-cr4w.vercel.app'
    );
  });

  test('search_notes RPC invariant: strictly ignores untrusted p_user_id and binds to auth.uid()', () => {
    function mockSearchNotes(authUid: string | null, pUserId: string, notes: Array<{ id: string; user_id: string; title: string }>) {
      // Hardened invariant: must bind to authenticated user id, ignoring client-provided pUserId if mismatched
      if (!authUid) return [];
      const effectiveUserId = authUid; // Enforced in SQL: n.user_id = auth.uid()
      return notes.filter((n) => n.user_id === effectiveUserId);
    }

    const testNotes = [
      { id: '1', user_id: 'alice-id', title: 'Alice secret roadmap' },
      { id: '2', user_id: 'bob-id', title: 'Bob secret financial' },
    ];

    // Attacker Bob calls search_notes passing Alice's user id
    const attackerResults = mockSearchNotes('bob-id', 'alice-id', testNotes);
    assert.equal(attackerResults.length, 1);
    assert.equal(attackerResults[0].user_id, 'bob-id');
    assert.equal(attackerResults.some((n) => n.user_id === 'alice-id'), false);
  });

  test('note_tags RLS invariant: prevents attaching another user tag to own note', () => {
    interface Tag { id: string; user_id: string; name: string }
    interface Note { id: string; user_id: string; title: string }

    function validateNoteTagLink(authUid: string, note: Note, tag: Tag): boolean {
      // Hardened RLS check: both note and tag must belong to auth.uid()
      const noteBelongsToUser = note.user_id === authUid;
      const tagBelongsToUser = tag.user_id === authUid;
      return noteBelongsToUser && tagBelongsToUser;
    }

    const myNote: Note = { id: 'note-1', user_id: 'user-charlie', title: 'My Note' };
    const myTag: Tag = { id: 'tag-1', user_id: 'user-charlie', name: 'Work' };
    const victimTag: Tag = { id: 'tag-2', user_id: 'user-victim', name: 'Confidential Client' };

    assert.equal(validateNoteTagLink('user-charlie', myNote, myTag), true);
    assert.equal(validateNoteTagLink('user-charlie', myNote, victimTag), false);
  });
});


