/**
 * FlowNote AI — Global Application Store (Zustand)
 *
 * Manages UI state, active note/task selection, and user session.
 * All data persistence is handled by the services layer (IndexedDB + Supabase).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LocalNote } from '@/lib/db/local';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
export type AppView = 'capture' | 'notes' | 'favorites' | 'tags' | 'tasks' | 'today' | 'search' | 'trash' | 'settings' | 'archive';

interface AppState {
  // ─── User ──────────────────────────────────────────────────
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userAvatar: string | null;
  isGuest: boolean;
  setUser: (
    id: string | null,
    email: string | null,
    metadata?: { name?: string | null; avatar?: string | null; isGuest?: boolean }
  ) => void;

  // ─── View ──────────────────────────────────────────────────
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  // ─── Note Selection ────────────────────────────────────────
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;

  // ─── Folder Filter ─────────────────────────────────────────
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;

  // ─── Sidebar ───────────────────────────────────────────────
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;

  // ─── Context Panel ─────────────────────────────────────────
  contextPanelOpen: boolean;
  setContextPanelOpen: (v: boolean) => void;
  toggleContextPanel: () => void;

  // ─── Theme ─────────────────────────────────────────────────
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // ─── Command Palette ───────────────────────────────────────
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  toggleCommandPalette: () => void;

  // ─── Notes Layout ──────────────────────────────────────────
  notesLayout: 'list' | 'grid';
  setNotesLayout: (layout: 'list' | 'grid') => void;

  // ─── Tag Filter ────────────────────────────────────────────
  selectedTagFilter: string | null;
  setSelectedTagFilter: (tag: string | null) => void;

  // ─── Sync ──────────────────────────────────────────────────
  syncStatus: SyncStatus;
  setSyncStatus: (s: SyncStatus) => void;
  pendingSyncCount: number;
  setPendingSyncCount: (n: number) => void;

  // ─── Search ────────────────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // ─── Notes cache (lightweight) ─────────────────────────────
  notes: LocalNote[];
  setNotes: (notes: LocalNote[]) => void;
  updateNoteInCache: (note: LocalNote) => void;
  removeNoteFromCache: (id: string) => void;

  // ─── Task count badges ─────────────────────────────────────
  todayTaskCount: number;
  setTodayTaskCount: (n: number) => void;
  overdueTaskCount: number;
  setOverdueTaskCount: (n: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      userId: null,
      userEmail: null,
      userName: null,
      userAvatar: null,
      isGuest: false,
      setUser: (id, email, metadata) =>
        set((state) => {
          const userChanged = state.userId !== id;
          return {
            userId: id,
            userEmail: email,
            userName: metadata?.name ?? null,
            userAvatar: metadata?.avatar ?? null,
            isGuest: metadata?.isGuest ?? (id === 'local'),
            ...(userChanged
              ? {
                  activeNoteId: null,
                  notes: [],
                  activeFolderId: null,
                  selectedTagFilter: null,
                  searchQuery: '',
                }
              : {}),
          };
        }),

      // View
      activeView: 'notes',
      setActiveView: (view) => set({ activeView: view }),

      // Note selection
      activeNoteId: null,
      setActiveNoteId: (id) => set({ activeNoteId: id }),

      // Folder
      activeFolderId: null,
      setActiveFolderId: (id) => set({ activeFolderId: id }),

      // Sidebar
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),

      // Context panel
      contextPanelOpen: false,
      setContextPanelOpen: (v) => set({ contextPanelOpen: v }),
      toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),

      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Command Palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

      // Notes Layout
      notesLayout: 'list',
      setNotesLayout: (notesLayout) => set({ notesLayout }),

      // Tag Filter
      selectedTagFilter: null,
      setSelectedTagFilter: (selectedTagFilter) => set({ selectedTagFilter }),

      // Sync
      syncStatus: 'idle',
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      pendingSyncCount: 0,
      setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),

      // Search
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      // Notes cache
      notes: [],
      setNotes: (notes) => set({ notes }),
      updateNoteInCache: (note) =>
        set((s) => ({
          notes: s.notes.some((n) => n.id === note.id)
            ? s.notes.map((n) => (n.id === note.id ? note : n))
            : [note, ...s.notes],
        })),
      removeNoteFromCache: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      // Task badges
      todayTaskCount: 0,
      setTodayTaskCount: (todayTaskCount) => set({ todayTaskCount }),
      overdueTaskCount: 0,
      setOverdueTaskCount: (overdueTaskCount) => set({ overdueTaskCount }),
    }),
    {
      name: 'flownote-app-state',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        contextPanelOpen: state.contextPanelOpen,
        theme: state.theme,
        activeView: state.activeView,
        activeFolderId: state.activeFolderId,
        notesLayout: state.notesLayout,
      }),
    }
  )
);
