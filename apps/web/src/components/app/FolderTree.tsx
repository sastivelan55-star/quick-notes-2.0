'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderNoteCounts,
} from '@/lib/services/folders';
import type { LocalFolder } from '@/lib/db/local';
import toast from 'react-hot-toast';
import { onSyncDataChanged } from '@/lib/services/sync-worker';

interface FolderNodeProps {
  folder: LocalFolder;
  allFolders: LocalFolder[];
  noteCounts: Record<string, number>;
  depth: number;
  activeFolderId: string | null;
  onSelect: (id: string | null) => void;
  onReload: () => void;
}

function FolderNode({
  folder,
  allFolders,
  noteCounts,
  depth,
  activeFolderId,
  onSelect,
  onReload,
}: FolderNodeProps) {
  const children = allFolders.filter((f) => f.parent_id === folder.id);
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showMenu, setShowMenu] = useState(false);
  const isActive = activeFolderId === folder.id;
  const count = noteCounts[folder.id] ?? 0;

  async function handleRename() {
    if (!editName.trim() || editName === folder.name) {
      setEditing(false);
      setEditName(folder.name);
      return;
    }
    try {
      await updateFolder(folder.id, { name: editName });
      toast.success('Folder renamed');
      onReload();
    } catch {
      toast.error('Failed to rename folder');
    }
    setEditing(false);
  }

  async function handleDelete() {
    setShowMenu(false);
    if (!window.confirm(`Delete "${folder.name}"? Notes inside will be moved to All Notes.`)) return;
    try {
      await deleteFolder(folder.id, { moveNotesToRoot: true });
      if (isActive) onSelect(null);
      onReload();
      toast.success('Folder deleted');
    } catch {
      toast.error('Failed to delete folder');
    }
  }

  async function handleAddSubfolder() {
    setShowMenu(false);
    const userId = useAppStore.getState().userId;
    if (!userId) return;
    try {
      await createFolder(userId, { name: 'New Folder', parent_id: folder.id });
      setExpanded(true);
      onReload();
    } catch {
      toast.error('Failed to create subfolder');
    }
  }

  return (
    <div>
      <div
        className={`folder-tree-item depth-${depth} ${isActive ? 'active' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: `4px 8px 4px ${12 + depth * 14}px`,
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          background: isActive ? 'var(--bg-primary)' : 'transparent',
          position: 'relative',
        }}
      >
        {/* Expand/Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
          style={{
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'none',
            color: 'var(--text-tertiary)',
            cursor: hasChildren ? 'pointer' : 'default',
            opacity: hasChildren ? 1 : 0,
            flexShrink: 0,
            padding: 0,
            borderRadius: 3,
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M7 5l6 5-6 5" />
          </svg>
        </button>

        {/* Folder icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill={folder.color ?? 'none'}
          stroke={folder.color ?? 'currentColor'}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, color: folder.color ?? 'var(--text-secondary)' }}
        >
          <path d="M2 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" />
        </svg>

        {/* Folder name */}
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setEditing(false);
                setEditName(folder.name);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              fontSize: 'var(--font-size-xs)',
              border: '1px solid var(--color-brand-500)',
              borderRadius: 3,
              padding: '1px 4px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            maxLength={60}
          />
        ) : (
          <span
            onClick={() => onSelect(folder.id)}
            style={{
              flex: 1,
              fontSize: 'var(--font-size-xs)',
              color: isActive ? 'var(--color-brand-600)' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {folder.name}
          </span>
        )}

        {/* Count badge */}
        {count > 0 && !editing && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              minWidth: 14,
              textAlign: 'right',
            }}
          >
            {count}
          </span>
        )}

        {/* Context menu button */}
        {!editing && (
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn folder-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((v) => !v);
              }}
              style={{ width: 18, height: 18, opacity: showMenu ? 1 : 0 }}
              title="Folder options"
              aria-label="Folder options"
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  onClick={() => setShowMenu(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '100%',
                    zIndex: 100,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    minWidth: 140,
                    padding: 4,
                  }}
                >
                  <button
                    className="sidebar-nav-item"
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); setEditing(true); }}
                    style={{ fontSize: 'var(--font-size-xs)', padding: '6px 10px', width: '100%' }}
                  >
                    ✏️ Rename
                  </button>
                  <button
                    className="sidebar-nav-item"
                    onClick={(e) => { e.stopPropagation(); handleAddSubfolder(); }}
                    style={{ fontSize: 'var(--font-size-xs)', padding: '6px 10px', width: '100%' }}
                  >
                    📁 Add subfolder
                  </button>
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                  <button
                    className="sidebar-nav-item"
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    style={{ fontSize: 'var(--font-size-xs)', padding: '6px 10px', width: '100%', color: 'var(--text-danger)' }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              noteCounts={noteCounts}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
              onReload={onReload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FolderTree (top-level component for Sidebar) ─────────────────
interface FolderTreeProps {
  collapsed?: boolean;
}

export default function FolderTree({ collapsed = false }: FolderTreeProps) {
  const { userId, activeFolderId, setActiveFolderId, setActiveView } = useAppStore();
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    const [all, counts] = await Promise.all([
      listFolders(userId),
      getFolderNoteCounts(userId),
    ]);
    setFolders(all);
    setNoteCounts(counts);
  }, [userId]);

  useEffect(() => {
    reload();
    const unsub = onSyncDataChanged(() => {
      reload();
    });
    return unsub;
  }, [reload]);

  async function handleAddFolder() {
    if (!userId || !newFolderName.trim()) {
      setAdding(false);
      setNewFolderName('');
      return;
    }
    try {
      await createFolder(userId, { name: newFolderName, parent_id: null });
      setAdding(false);
      setNewFolderName('');
      await reload();
      toast.success('Folder created');
    } catch {
      toast.error('Failed to create folder');
    }
  }

  function handleSelectFolder(id: string | null) {
    setActiveFolderId(id);
    setActiveView('notes');
  }

  const rootFolders = folders.filter((f) => f.parent_id === null);

  if (collapsed) return null;

  return (
    <div style={{ padding: '0 var(--space-2)' }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px 2px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Folders
        </span>
        <button
          className="icon-btn"
          onClick={() => setAdding(true)}
          title="New folder"
          aria-label="New folder"
          style={{ width: 18, height: 18 }}
          id="new-folder-btn"
        >
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M10 4v12M4 10h12" />
          </svg>
        </button>
      </div>

      {/* New folder input */}
      {adding && (
        <div style={{ padding: '2px 8px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFolder();
              if (e.key === 'Escape') { setAdding(false); setNewFolderName(''); }
            }}
            onBlur={handleAddFolder}
            placeholder="Folder name..."
            maxLength={60}
            style={{
              flex: 1,
              fontSize: 'var(--font-size-xs)',
              padding: '3px 8px',
              border: '1px solid var(--color-brand-500)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            id="new-folder-input"
            aria-label="New folder name"
          />
        </div>
      )}

      {/* Folder tree */}
      {rootFolders.length === 0 && !adding ? (
        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            padding: '4px 8px 8px',
            margin: 0,
          }}
        >
          No folders yet
        </p>
      ) : (
        <div style={{ paddingBottom: 'var(--space-2)' }}>
          {rootFolders.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              allFolders={folders}
              noteCounts={noteCounts}
              depth={0}
              activeFolderId={activeFolderId}
              onSelect={handleSelectFolder}
              onReload={reload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
