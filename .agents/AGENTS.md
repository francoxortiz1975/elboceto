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
│       ├── AreaPlanner.jsx         # "Plan por áreas": time (30-min grid today → days → backlog) × life-area columns, day/area lenses
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
  - `el_boceto_area_plan_v1` (Plan por áreas; local-only, see `src/lib/areaPlan.js`)
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

---

## Google Calendar sync (app → Google, one way)

- `api/gcal.js` (Vercel function) writes the plan's dated items to one shared Google Calendar as a **service account**; there is no OAuth consent screen. Only the signed-in user whose e-mail is `GOOGLE_SYNC_USER_EMAIL` may call it.
- Env vars (Vercel): `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SYNC_USER_EMAIL`. The calendar must be shared with the service account's e-mail ("Make changes to events").
- `src/lib/gcalSync.js` (pure: builds events, diffs the plan against `plan.gcal.map`) and `src/lib/useGcalSync.js` (debounced sync while `plan.gcal.on`). The item → Google event map lives in the plan, so it syncs across devices and deletions are detected by diffing.
- Event colors: Google only has 11 fixed `colorId`s, so each area color maps to the closest one (`AREA_COLOR_IDS` in `gcalSync.js`, same order as `AREA_COLORS`).
- The toggle is in the ⋮ menu ("GOOGLE CALENDAR"). `/api` only exists on Vercel, not in `vite dev`.

---

## Every block has an area

- Creating a block (double click on the week, on the "sin hora" strip, on the mini "hoy" panel, or dragging a loose task / a note's check onto the week) always opens `AreaPicker` ("¿Para qué área?") first; nothing is created until an area is chosen.
- Old events without an area (dated Planificador tasks and canvas notes with a date) are listed by `UnassignedEvents` (auto-opens once per session, or from the ⋮ menu); each becomes a normal block only when you pick an area (`src/lib/legacyEvents.js`).
- A note's check that was dragged onto the week keeps `areaItemId` on its block, which hides it from "Pendientes" while that block exists.

## Content plans (stack of posts)
- `src/lib/contentPlan.js` imports a `boceto-content-plan` JSON (format in `docs/CONTENT_PLAN_FORMAT.md`, example `docs/sumay-instagram.plan.json`) from the ⋮ menu. It adds the area, dated blocks and `plan.stacks[id]` (order + Reel details).
- The stack UI is `components/ReelStack.jsx` (left panel, plan views) with `ReelDetail.jsx`. Reordering calls `moveReel`/`nudgeReel`, which re-dates the Reel blocks (`applyStack`); posted Reels (`done`) keep their slot.
- Reel blocks carry `stackId` + `reel`; "Film + edit" blocks carry `film` (week number) and their text is regenerated from the stack order.
- One script panel for the whole app: `components/ReelDetailHost.jsx` (mounted in `App.jsx`) listens for `openReel(item)` (`lib/contentPlan.js`), called from the stack cards, `AreaPlanner` (Día completo / Tablero), `WeeklyPlanner` and `MonthCalendar`. Fields are Hook / Body / CTA / Caption; edits live in `plan.stacks[id].reels[rid].edits` and survive re-imports.
- `exportContentPlan(plan, stackId)` writes the plan back in the import format (ordered Reels with edits applied, `posted`), for the content conversation.

