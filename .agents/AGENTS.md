# EL BOCETO — Agent Guidelines & Repository Architecture

Welcome to **EL BOCETO**, a dynamic freeform digital notebook, paper-like canvas, and weekly planner built with React and Vite.

---

## 1. Project Overview

EL BOCETO blends freeform note-taking on an infinite grid canvas with an integrated weekly task planner.

- **Tech Stack**: React, Vite, Vanilla CSS, Lucide React icons.
- **Key Concepts**: Block-based notes (headings, checklists, numbered lists, toggle lists), grid snapping, infinite viewport panning, marquee selection, undo/redo history, and Google Calendar sync.

---

## 2. Directory & Component Structure

```
EL_BOCETO/
├── index.html
├── src/
│   ├── App.jsx                     # Root component: App state, persistence, undo/redo, top header
│   ├── App.css                     # App-specific layout & header styles
│   ├── index.css                   # Core Design System: Variables, grids, block typography, canvas styles
│   └── components/
│       ├── CanvasBoard.jsx         # Canvas surface: Panning, marquee selection, drag & drop, grid snap
│       ├── FreeformNode.jsx        # Freeform note container: Card vs text mode, context menu bar, block management
│       ├── NoteBlock.jsx           # Individual block editor: Keyboard shortcuts (TAB, Enter, Backspace), block types
│       ├── WeeklyPlanner.jsx       # Weekly calendar grid view & task scheduler
│       ├── LeftEdgePanel.jsx       # Slide-out sidebar: View switching, grid modes (dots/lines/clean), filter, export
│       ├── SidebarList.jsx         # Alternative list view of notes
│       ├── GoogleCalendarModal.jsx # Google Calendar sync modal interface
│       └── BlockItems/             # Specialized block renderers
│           ├── ChecklistBlock.jsx  # Interactive checkmark block
│           ├── NumberedBlock.jsx   # Auto-numbered list item block
│           └── ToggleBlock.jsx     # Collapsible toggle block with child items
```

---

## 3. Core Architecture & Concepts

### State Management & Persistence (`src/App.jsx`)
- **Notes State**: Array of note objects with `{ id, x, y, isCard, color, date, calendarSynced, blocks: [...] }`.
- **Planner State**: Array of task objects with `{ id, text, completed, dayKey, timeSlot }`.
- **Viewport State**: `{ pan: { x, y } }`. Note: Scale/zoom is kept fixed at 1:1 for grid alignment.
- **LocalStorage Keys**:
  - `el_boceto_notes_v2`
  - `el_boceto_planner_v1`
  - `el_boceto_viewport_v1`
- **History (Undo/Redo)**: Notes mutations push snapshots into an undo history stack.

### Grid System (`src/components/CanvasBoard.jsx`)
- **Grid Dimensions**: `GRID_X = 24`px, `GRID_Y = 28`px.
- **Grid Modes**: `dots` (`.bg-grid-dots`), `lines` (`.bg-grid-lines`), and `clean` (`.bg-clean`).
- **Grid Snapping**: Coordinates are snapped using `Math.round(val / GRID) * GRID`.

### Block Editor Logic (`src/components/NoteBlock.jsx`)
- **Markdown-like Shortcuts**:
  - `[] ` or `- ` $\rightarrow$ Checklist block
  - `1. ` $\rightarrow$ Numbered block
  - `# ` $\rightarrow$ Heading block
  - `> ` $\rightarrow$ Toggle block
- **Navigation & Editing**:
  - `Enter` $\rightarrow$ Create new block below (or split text)
  - `Backspace` on empty block $\rightarrow$ Remove block or merge with previous block
  - `TAB` / `Shift+TAB` $\rightarrow$ Indent / Outdent child blocks

---

## 4. Development & Styling Conventions

1. **Styling**: Always use Vanilla CSS classes defined in `src/index.css`. Maintain paper-like typography, soft shadows, and subtle micro-animations.
2. **Component Integrity**: Keep state mutations immutable and push to history when modifying notes.
3. **Touch & Mobile Support**: Event handlers in `CanvasBoard` handle both mouse (`onMouseDown`, `onMouseMove`) and touch (`onTouchStart`, `onTouchMove`) events via standard helper `getCoords(e)`.
