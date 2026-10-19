'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import CaptureView from '@/components/views/CaptureView';
import NotesView from '@/components/views/NotesView';
import TasksView from '@/components/views/TasksView';
import TodayView from '@/components/views/TodayView';
import SearchView from '@/components/views/SearchView';
import TrashView from '@/components/views/TrashView';
import SettingsView from '@/components/views/SettingsView';

import { createNote } from '@/lib/services/notes';

export default function AppPage() {
  const activeView = useAppStore((s) => s.activeView);

  // Global keyboard shortcut: Cmd/Ctrl+N for new note
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const uid = useAppStore.getState().userId;
        if (uid) {
          createNote(uid, {
            title: 'Untitled Note',
            content: '',
            content_text: '',
            word_count: 0,
            tags: ['Ideas'],
          }).then((n) => {
            useAppStore.getState().setActiveView('notes');
            useAppStore.getState().setActiveNoteId(n.id);
          });
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const views: Record<string, React.ReactNode> = {
    notes: <NotesView />,
    favorites: <NotesView filter="favorites" />,
    tags: <NotesView filter="tags" />,
    tasks: <TasksView />,
    today: <TodayView />,
    search: <SearchView />,
    trash: <TrashView />,
    archive: <NotesView status="archived" />,
    settings: <SettingsView />,
    capture: <CaptureView />,
  };

  return <>{views[activeView] ?? <NotesView />}</>;
}
