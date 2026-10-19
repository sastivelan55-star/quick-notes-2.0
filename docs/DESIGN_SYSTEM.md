# NoteNest / FlowNote AI — Design System Specification
**Document Version:** 1.0.0  
**Design Phase:** Phase 00 — Design Baseline & Visual Lock  

---

## 1. Brand Identity & Visual Language

NoteNest follows an elegant, clean, and modern productivity aesthetic characterized by:
- **Primary Hue**: NoteNest Royal Blue (`#2563EB` / `rgb(37, 99, 235)`).
- **Surface Elevation**: Flat, clean surfaces with hairline borders (`1px solid var(--border-subtle)`) and soft ambient shadows.
- **Visual Density**: Balanced whitespace, legible line lengths (max 72ch in editor), and clear visual hierarchy.
- **Pill Badges**: Distinctive rounded pills for active navigation, tag categories, and action buttons.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Brand Tokens
```css
:root {
  --color-brand-50:  hsl(217, 95%, 97%);  /* #EFF6FF - Soft tint */
  --color-brand-100: hsl(217, 92%, 93%);  /* #DBEAFE - Tag pill bg */
  --color-brand-200: hsl(217, 90%, 86%);  /* #BFDBFE */
  --color-brand-300: hsl(217, 88%, 74%);  /* #93C5FD */
  --color-brand-400: hsl(217, 86%, 63%);  /* #60A5FA */
  --color-brand-500: #2563eb;             /* #2563EB - NoteNest Primary Blue */
  --color-brand-600: #1d4ed8;             /* #1D4ED8 - Hover / Darker */
  --color-brand-700: #1e40af;             /* #1E40AF - Active / Focus */
  --color-brand-800: hsl(217, 75%, 32%);
  --color-brand-900: hsl(217, 70%, 24%);
}
```

### 2.2 Category & Tag Pill Palette (Reference Image 1, 2 & 5)
```css
:root {
  /* Ideas (Blue) */
  --tag-ideas-bg: #dbeafe;
  --tag-ideas-text: #1d4ed8;
  
  /* Important (Orange/Coral) */
  --tag-important-bg: #ffedd5;
  --tag-important-text: #c2410c;

  /* Personal / Journal (Amber/Yellow) */
  --tag-personal-bg: #fef3c7;
  --tag-personal-text: #b45309;

  /* Work / Project (Green) */
  --tag-work-bg: #d1fae5;
  --tag-work-text: #047857;

  /* Research / Study (Purple) */
  --tag-study-bg: #ede9fe;
  --tag-study-text: #6d28d9;
}
```

### 2.3 Theme Tokens (Light vs. Dark Mode)
```css
/* Light Mode */
[data-theme='light'] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-quaternary: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
  --border-subtle: #f1f5f9;
  --border-default: #e2e8f0;
  --border-strong: #cbd5e1;
  --bg-brand-subtle: #eff6ff;
  --text-brand: #2563eb;
}

/* Dark Mode */
[data-theme='dark'] {
  --bg-primary: #0b0f17;
  --bg-secondary: #111827;
  --bg-tertiary: #1e293b;
  --bg-quaternary: #334155;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --border-subtle: #1e293b;
  --border-default: #334155;
  --border-strong: #475569;
  --bg-brand-subtle: rgba(37, 99, 235, 0.16);
  --text-brand: #60a5fa;
}
```

---

## 3. Typography Scale

Font Family: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`  
Monospace: `'JetBrains Mono', 'Fira Code', monospace`

| Token | Size | Line Height | Weight | Typical Usage |
|---|---|---|---|---|
| `--font-size-xs` | 0.75rem (12px) | 1.4 | 500 / 600 | Timestamps, tag badges, metadata |
| `--font-size-sm` | 0.875rem (14px) | 1.5 | 400 / 500 | Sidebar items, note snippets, task labels |
| `--font-size-base` | 1.0rem (16px) | 1.6 | 400 / 500 | Editor body text, inputs |
| `--font-size-lg` | 1.125rem (18px) | 1.4 | 600 | Section headers, card titles |
| `--font-size-xl` | 1.25rem (20px) | 1.3 | 600 | Modal titles, column headers |
| `--font-size-2xl` | 1.5rem (24px) | 1.25 | 700 | Note title in editor (H1), page titles |
| `--font-size-3xl` | 1.875rem (30px) | 1.2 | 700 | Primary branding display |

---

## 4. Spacing System (4px Base Grid)

| Token | Dimension | Token | Dimension |
|---|---|---|---|
| `--space-1` | 4px (0.25rem) | `--space-6` | 24px (1.5rem) |
| `--space-2` | 8px (0.5rem) | `--space-8` | 32px (2.0rem) |
| `--space-3` | 12px (0.75rem) | `--space-10` | 40px (2.5rem) |
| `--space-4` | 16px (1.0rem) | `--space-12` | 48px (3.0rem) |
| `--space-5` | 20px (1.25rem) | `--space-16` | 64px (4.0rem) |

---

## 5. Border Radius & Shadows

- `--radius-sm`: `4px` (subtle badges, checkboxes)
- `--radius-md`: `8px` (inputs, list items)
- `--radius-lg`: `12px` (cards, dialogs)
- `--radius-xl`: `16px` (checklist cards, modals)
- `--radius-full`: `9999px` (pill buttons, tag badges, circular action buttons)
- `--shadow-sm`: `0 1px 2px rgba(0, 0, 0, 0.05)`
- `--shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)`
- `--shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)`
- `--shadow-xl`: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`

---

## 6. Core Component Standards

### 6.1 Buttons
1. **Primary Button (`.btn-primary`)**:
   - `background: var(--color-brand-500); color: #fff; border-radius: var(--radius-full);`
   - Used for `+ New Note` and primary commitments.
2. **Secondary Button (`.btn-secondary`)**:
   - `background: var(--bg-tertiary); color: var(--text-primary); border-radius: var(--radius-full);`
   - Used for filters, auxiliary tools (Voice, AI).
3. **Floating Action Button (`.fab-btn`)**:
   - `width: 52px; height: 52px; border-radius: var(--radius-full); background: var(--color-brand-500);`
   - Displayed on mobile viewports at bottom-right for instant note creation.

### 6.2 Checklists & Tasks (Reference Image 4)
- **Checkmark Circle (`.task-check-circle`)**:
  - Unchecked: `18px` circular outline with `2px solid var(--border-strong)`.
  - Checked: Filled circle in `#2563EB` with centered white checkmark `✔`.
- **Deadline Badge (`.task-due-badge`)**:
  - Aligned to right of task item.
  - Text: `Today`, `Tomorrow`, `Oct 28`. Font size `var(--font-size-xs)`.
- **Card Container (`.checklist-card`)**:
  - `background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl);`

### 6.3 Pastel Multi-Column Note Cards (Reference Image 2)
```css
/* Light Mode */
--pastel-peach-bg: #ffedd5;    --pastel-peach-border: #fed7aa;    --pastel-peach-text: #7c2d12;
--pastel-mint-bg: #dcfce7;     --pastel-mint-border: #bbf7d0;     --pastel-mint-text: #14532d;
--pastel-sky-bg: #e0f2fe;      --pastel-sky-border: #bfdbfe;      --pastel-sky-text: #0c4a6e;
--pastel-lavender-bg: #f3e8ff; --pastel-lavender-border: #e9d5ff; --pastel-lavender-text: #581c87;
--pastel-butter-bg: #fef9c3;   --pastel-butter-border: #fef08a;   --pastel-butter-text: #713f12;

/* Dark Mode */
--pastel-peach-bg: hsl(28, 45%, 15%);    --pastel-peach-border: hsl(28, 40%, 25%);
--pastel-mint-bg: hsl(142, 35%, 14%);    --pastel-mint-border: hsl(142, 35%, 24%);
--pastel-sky-bg: hsl(204, 40%, 15%);     --pastel-sky-border: hsl(204, 35%, 25%);
--pastel-lavender-bg: hsl(270, 35%, 16%);--pastel-lavender-border: hsl(270, 30%, 26%);
--pastel-butter-bg: hsl(54, 40%, 14%);   --pastel-butter-border: hsl(54, 35%, 24%);
```
- **Grid Layout**: Auto-fill minmax 180px responsive grid.
- **Card Elements**: Title, body snippet, tag chips, timestamp, and quick-favorite star action button.

### 6.4 Command Palette (`Cmd/Ctrl + K`)
- **Backdrop**: `rgba(0, 0, 0, 0.45)` with `backdrop-filter: blur(4px)`.
- **Modal**: `max-width: 600px`, `border-radius: var(--radius-xl)`, elevated shadow `0 20px 40px rgba(0,0,0,0.2)`.
- **Keyboard Badges**: Inline `<kbd>` elements with `border: 1px solid var(--border-subtle)` and subtle radius.
- **Navigation Categories**: Navigation (`G N`, `G F`, `G T`, `G K`, `G D`, `G S`), Actions (`⌘N`, `⌘T`), Theme, Notes.

### 6.5 3-Pane Responsive Layout Breakdown
- **Desktop (≥1024px)**:
  - Left Sidebar: `240px` fixed width with collapse toggle (`240px` ↔ `60px`).
  - Middle Explorer: `320px` fixed width with note list, list/grid toggle, search, and `+ New Note` blue pill button.
  - Right Detail Canvas: Flex-1 remaining width with rich editor and interactive tag pills.
- **Tablet (768px – 1023px)**:
  - Sidebar collapses to compact icon mode (`60px`).
  - Middle Explorer: `280px` – `320px`.
  - Right Editor: Remaining space (2-pane workflow).
- **Mobile (<768px)**:
  - Single active pane at a time (`notes-list-pane` ↔ `notes-editor-pane`).
  - Top mobile header with hamburger menu `≡`, NoteNest logo, search `🔍`, and back arrow `←` when in editor.
  - Bottom navigation bar (`Notes`, `Tasks`, `Search`, `Settings`) with touch targets ≥ 48px and safe area inset support.
  - Floating Action Button (`+` FAB) at bottom-right for instant note creation.
