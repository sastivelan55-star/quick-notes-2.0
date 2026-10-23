'use client';

import { useAppStore, type AppView } from '@/store/app-store';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { createNote } from '@/lib/services/notes';
import FolderTree from '@/components/app/FolderTree';
import { triggerSyncNow, getSyncDiagnostics } from '@/lib/services/sync-worker';
import toast from 'react-hot-toast';

const NAV_ITEMS: {
  id: AppView;
  label: string;
  icon: React.ReactNode;
  badgeKey?: 'todayTaskCount' | 'overdueTaskCount';
}[] = [
  {
    id: 'notes',
    label: 'All Notes',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <path d="M4 4h12M4 8h12M4 12h8M4 16h6" />
      </svg>
    ),
  },
  {
    id: 'favorites',
    label: 'Favorites',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <path d="M10 2l2.5 5.5H18l-4.5 3.5 1.7 6-5.2-3.8L4.8 17l1.7-6L2 7.5h5.5L10 2z" />
      </svg>
    ),
  },
  {
    id: 'tags',
    label: 'Tags',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <path d="M2 10V4a2 2 0 0 1 2-2h6l8 8a2 2 0 0 1 0 2.83l-4 4a2 2 0 0 1-2.83 0L2 10z" />
        <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <circle cx="10" cy="10" r="7" />
        <path d="M7 10l2 2 4-4" />
      </svg>
    ),
    badgeKey: 'overdueTaskCount',
  },
  {
    id: 'today',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <rect x="3" y="4" width="14" height="14" rx="2" />
        <path d="M7 2v4M13 2v4M3 9h14" />
      </svg>
    ),
    badgeKey: 'todayTaskCount',
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <rect x="2" y="3" width="16" height="4" rx="1" />
        <path d="M4 7v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
        <path d="M8 11h4" />
      </svg>
    ),
  },
];

const BOTTOM_ITEMS: {
  id: AppView;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'trash',
    label: 'Trash',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <path d="M4 6h12l-1 11H5L4 6zM2 6h16M8 6V4h4v2M8 10v5M12 10v5" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
        <circle cx="10" cy="10" r="2.5" />
        <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.41 1.41M13.54 13.54l1.41 1.41M5.05 14.95l1.41-1.41M13.54 6.46l1.41-1.41" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    activeView,
    setActiveView,
    syncStatus,
    pendingSyncCount,
    todayTaskCount,
    overdueTaskCount,
    userId,
    userEmail,
    userName,
    userAvatar,
    isGuest,
    setUser,
    theme,
    setTheme,
  } = useAppStore();

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
      toast.success('Signed out');
      router.push('/auth/login');
    } catch {
      router.push('/auth/login');
    }
  }

  function handleSignIn() {
    router.push('/auth/login?next=/app');
  }

  function handleNavClick(view: AppView) {
    setActiveView(view);
    setMobileSidebarOpen(false);
  }

  const badges: Record<string, number> = {
    todayTaskCount,
    overdueTaskCount,
  };

  const syncLabel = {
    idle: 'Synced',
    syncing: 'Syncing...',
    error: 'Sync error',
    offline: 'Offline',
  }[syncStatus];

  const syncDotClass = {
    idle: 'sync-dot synced',
    syncing: 'sync-dot pending',
    error: 'sync-dot error',
    offline: 'sync-dot',
  }[syncStatus];

  return (
    <>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 'var(--z-overlay)' as never,
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className="sidebar-header">
          <a
            className="sidebar-logo"
            onClick={() => handleNavClick('notes')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
            aria-label="LifeMap OS — go to dashboard"
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="rgba(255,255,255,0.2)" />
              </svg>
            </div>
            <span className="sidebar-logo-text" style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              LifeMap OS
            </span>
          </a>

          <button
            className="icon-btn"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {sidebarCollapsed ? (
                <path d="M5 10h10M10 6l4 4-4 4" />
              ) : (
                <path d="M15 10H5M10 6L6 10l4 4" />
              )}
            </svg>
          </button>
        </div>

        {/* New note quick action */}
        <div style={{ padding: 'var(--space-3) var(--space-3) 0' }}>
          <button
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: 'var(--space-2)',
              overflow: 'hidden',
            }}
            onClick={async () => {
              const uid = useAppStore.getState().userId;
              if (uid) {
                try {
                  const newNote = await createNote(uid, {
                    title: 'Untitled Note',
                    content: '',
                    content_text: '',
                    word_count: 0,
                    tags: ['Ideas'],
                  });
                  useAppStore.getState().setActiveView('notes');
                  useAppStore.getState().setActiveNoteId(newNote.id);
                  toast.success('Note created');
                } catch {
                  useAppStore.getState().setActiveView('notes');
                }
              } else {
                useAppStore.getState().setActiveView('notes');
              }
              setMobileSidebarOpen(false);
            }}
            title="New note (⌘N)"
            id="new-note-btn"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 4v12M4 10h12" />
            </svg>
            <span className="sidebar-nav-item-label">New Note</span>
            {!sidebarCollapsed && (
              <span className="kbd" style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.6 }}>⌘N</span>
            )}
          </button>
        </div>

        {/* Quick Search & Command Palette Trigger */}
        <div style={{ padding: 'var(--space-2) var(--space-3) 0' }}>
          <button
            className="sidebar-nav-item"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => {
              useAppStore.getState().setCommandPaletteOpen(true);
              setMobileSidebarOpen(false);
            }}
            title="Search notes and commands (⌘K)"
            aria-label="Search and command palette"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="9" cy="9" r="5" /><path d="M14 14l3 3" />
              </svg>
              {!sidebarCollapsed && <span>Search notes...</span>}
            </div>
            {!sidebarCollapsed && <kbd className="kbd" style={{ fontSize: '10px', opacity: 0.7 }}>⌘K</kbd>}
          </button>
        </div>

        {/* Nav items */}
        <div className="sidebar-nav">
          <div className="sidebar-nav-section">
            {NAV_ITEMS.map((item) => {
              const badge = item.badgeKey ? badges[item.badgeKey] : 0;
              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  id={`nav-${item.id}`}
                  aria-current={activeView === item.id ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="sidebar-nav-item-label">{item.label}</span>
                  {badge > 0 && (
                    <span className="sidebar-nav-item-badge" aria-label={`${badge} items`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Folder Tree */}
          {!sidebarCollapsed && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
              <FolderTree collapsed={sidebarCollapsed} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Bottom nav items */}
          {BOTTOM_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              title={item.label}
              id={`nav-${item.id}`}
              style={{ marginBottom: 'var(--space-1)' }}
            >
              {item.icon}
              <span className="sidebar-nav-item-label">{item.label}</span>
            </button>
          ))}

          {/* Sync status */}
          {!sidebarCollapsed && (
            <button
              className="sync-status"
              style={{
                padding: 'var(--space-2)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                textAlign: 'left',
                color: 'inherit',
                font: 'inherit',
              }}
              onClick={() => {
                triggerSyncNow();
                const d = getSyncDiagnostics();
                if (d.userId) {
                  toast.success(`Sync active (User ${d.userMaskedId ?? 'authenticated'}, ${d.pendingCount} pending)`);
                } else {
                  toast('Running in local mode');
                }
              }}
              title="Click to trigger cloud synchronization"
              aria-label="Cloud synchronization status"
            >
              <div className={syncDotClass} />
              <span>{syncStatus === 'syncing' && pendingSyncCount > 0 ? `Syncing ${pendingSyncCount}...` : syncLabel}</span>
            </button>
          )}

          {/* Theme toggle */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-1)',
              padding: 'var(--space-2)',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              overflow: 'hidden',
            }}
          >
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                className={`icon-btn ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)}
                title={`${t.charAt(0).toUpperCase() + t.slice(1)} theme`}
                aria-label={`Switch to ${t} theme`}
                aria-pressed={theme === t}
              >
                {t === 'light' && (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <circle cx="10" cy="10" r="4" />
                    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" />
                  </svg>
                )}
                {t === 'dark' && (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M17 12A7 7 0 1 1 8 3a5 5 0 0 0 9 9z" />
                  </svg>
                )}
                {t === 'system' && (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <rect x="2" y="3" width="16" height="12" rx="2" />
                    <path d="M7 19h6M10 15v4" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* User Account / Auth Section */}
          {!sidebarCollapsed ? (
            !isLocalMode ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  marginTop: 'var(--space-1)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                  {userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userAvatar}
                      alt={userName || 'Avatar'}
                      style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'var(--color-brand-500, #2563eb)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 'bold',
                      }}
                    >
                      {(userName || userEmail || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={userName || userEmail || undefined}
                    >
                      {userName || userEmail?.split('@')[0]}
                    </div>
                  </div>
                </div>

                <button
                  className="icon-btn"
                  onClick={handleSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  id="sign-out-btn"
                  style={{ width: 28, height: 28 }}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <path d="M13 10H3M3 10l3-3M3 10l3 3M10 4l1-1h6v14h-6l-1-1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                className="sidebar-nav-item"
                onClick={handleSignIn}
                title="Sign in with Google"
                style={{ marginTop: 'var(--space-1)' }}
                id="sidebar-sign-in-btn"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="sidebar-nav-item-icon">
                  <path d="M10 2a5 5 0 0 0-5 5v3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H7V7z" />
                </svg>
                <span className="sidebar-nav-item-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Sign in with Google
                </span>
              </button>
            )
          ) : (
            <button
              className="icon-btn"
              onClick={!isLocalMode ? handleSignOut : handleSignIn}
              title={!isLocalMode ? 'Sign out' : 'Sign in with Google'}
              aria-label={!isLocalMode ? 'Sign out' : 'Sign in with Google'}
              style={{ margin: 'var(--space-2) auto 0 auto', width: 32, height: 32 }}
            >
              {!isLocalMode ? (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M13 10H3M3 10l3-3M3 10l3 3M10 4l1-1h6v14h-6l-1-1" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <circle cx="10" cy="10" r="7" />
                  <path d="M10 7v6M7 10h6" />
                </svg>
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
