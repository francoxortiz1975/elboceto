# El Boceto scheduler: architecture sketch

Status: prototype only (`docs/scheduler-prototype/`: `engine.js` is the pure engine, `ui.js` + `style.css` the panels,
`python3 build.py` assembles `motor.html`). Nothing here is wired into the app yet.

## Decision pipeline
1. **Trigger**: end of day, a task not done, a new fixed event that collides, a task that overran, manual "replan".
2. **Hard constraints** (rules): sleep, classes, meals, commute, hard deadlines, "not before". Output: grid of free 30-min slots.
3. **Stage A, turn**: order tasks by urgency = priority + area rank + deadline closeness + accumulated delay (weighted).
4. **Stage B, placement**: score every valid slot: distance to original day, energy match, earliest, deadline slack,
   deep-work cap, area balance (weighted). Best slot wins; the next alternatives are kept for explanation.
5. **History sanity check** (planned): compare with what the user actually completed (day/hour success rates).
6. **Explainable output**: list of changes with reasons and confidence; safe+small changes apply, others are proposed.
7. **Learning** (planned): log accepted / edited / rejected and planned-vs-actual; tune durations and weights with simple statistics.

## Data in six layers
1. Profile (sleep, meals, work window, energy, deep-work cap, buffers, commute)
2. Fixed calendar (classes, shifts, appointments; place; optional)
3. Tasks (fixed/flexible, priority 1-5, hard/soft deadline, duration, effort, place, not-before, divisible, depends-on, cadence-bound)
4. Time map (computed, never stored)
5. History (event log, from day one)
6. Learned preferences (derived from the history, kept apart from the profile)

## Where it will live
- `src/lib/scheduler/` pure module (profile, grid, constraints, urgency, scoring, planner, explain, history), shared by the app and the MCP server.
- Replay: past weeks can be re-run through new rules to check the new version would have decided better.
- Claude only for ambiguity, explanations and the morning routine; the core needs no model.

## In the app (first cut)
- Plan tab **Motor** (`src/components/SchedulerPage.jsx`): Perfil, Calendario fijo, Áreas, Tareas, Pesos, Simulación.
- Engine: `src/lib/scheduler/engine.js` (pure); settings and real-plan mapping: `src/lib/scheduler/config.js`.
- Settings live in `plan.scheduler` (profile, fixed events, areaOrder, weights, per-item attrs), so they sync like the rest of the plan.
- Fixed events can rotate: every week, alternate weeks, or an N-week cycle (`cycle`, `weeks`, `anchor`), with a valid range and skipped dates.
- The simulation proposes; "Aplicar" moves the chosen tasks (with an in-page confirm and an undo right after) and logs every move in `plan.scheduler.history`.
