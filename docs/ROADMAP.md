# Roadmap and saved ideas

Status of what exists, and ideas saved for later. Ideas are not decided: each one lists what is still open.

## Done
| Phase | What |
|---|---|
| 1 | Locks: a locked block must happen exactly where it is |
| 2 | Hours per area, fixed task/meeting lengths, task vs meeting |
| 3 / 3b | Fixed events as real blocks (button), habits N per week / month, preferred days (chores) |
| 4 | Nightly reschedule at 00:00 Paris (server cron + first open of the day), summary and Deshacer |
| IRIS v1 | Inbox between the planner and one conversation per area (hooks, MCP tools, Motor > IRIS) |
| Sync | Saves never overwrite a newer cloud copy; three-way merge |
| IRIS+ | A block can open its area's conversation by itself (Mac launcher) |

## Next / pending
- **IRIS+ v2**: the same without the Mac on (cloud sessions started by a scheduled task). Precision would be about an hour.
- **Recipes** (later than IRIS): library of favourite recipes, rotation over the meals, **meal prep** block (Saturday or Sunday), shopping list that feeds "hacer las compras".
- **Google Meet** created automatically for meetings (the `meeting` kind already exists; needs the Google Calendar sync).
- Decide the **Next.js security update** in `loginet-web` (separate branch; verify the advisory from official sources) and merge `textos-finales`.
- Verify the nightly server job tomorrow morning (card "Reagendamiento de esta noche" in Motor > Pendientes) and the MediLyft hook (`MEDILYFT/teledox`).
- Telegram quick capture (needs an Anthropic API key): optional, last.

---

## Idea: living documentation per area (Obsidian), read and written by IRIS too
*Saved from the conversation. First for Loginet and MediLyft, then the other areas.*

**What**: for each area, structured markdown that stays current by itself.
1. **Context README**: what the project is, who it is for, stack, how to run it, key decisions and why, glossary, links. The first thing a new conversation (or IRIS) reads.
2. **Journal of changes and features**: append-only evolution of the project (date, what changed, why, link to the commit / PR). Updated automatically on every push, when a contract is created, when a feature ships.
3. Later, more technical docs (architecture, API, runbooks) once the first two are solid.

**Two-way with IRIS**: IRIS reads the journal to know what is going on in each area (and shows it in the hub / the app), and the area conversations and the nightly job can write to it.

**Open questions**
- Where does it live: inside each repo (`docs/`), or in the Obsidian vault (`DEV/DevProjects`) with a folder per area? (A vault outside the repo is not reachable from the cloud or from Vercel.)
- What triggers the journal: git has no post-push hook (a `pre-push`/`post-commit` hook does the job locally), a Claude Code hook can do it when a conversation commits/pushes, a GitHub Action can do it for everything that reaches `main`. Probably the first two, plus the Action as a safety net.
- Who writes the entry: a plain template filled from the commit message, or a short summary written by Claude. The second costs a model call per push.
- "Contrato creado": which contract? (a client contract, an API contract, something else) to decide what event writes the entry.
- IRIS access: new MCP tools like `read_journal(area)` / `append_journal(area, entry)`; the hook of an area conversation could also show the last journal entries at startup.

---

## Idea: School as a course workspace + study planning
*Saved from the conversation. Not decided if it lives in Claude Code, in El Boceto, or both.*

**1. Structured course documentation.** One folder per course with the same shape: context README (syllabus, teacher, weights, rules), `materials/` (everything the course gives), `notes/` (the user's own notes), `guides/` (generated review guides), `exams.md`, `grades.md`.

**2. Course material in, review guides out.** Upload ALL the course material, take notes alongside, and let Claude cross both sources to build **review guides** (by exam or by topic), flag what the notes miss versus the material, and keep them updated as new material arrives.

**3. Exam dates and runway.** Exam dates as locked blocks in El Boceto. A **runway** counts backwards from each exam: how many study sessions are needed, where they fit around classes and the other areas, using the habit/quota engine (N study blocks before the exam) and the nightly reschedule when something slips.

**4. Grades dashboard (grade tracker).** Current grades per course, weights, current average, and what is needed on the remaining exams to reach a target. A small data-analyst view: progress, risk, and how the study time was spent versus the result.

**Why it fits what exists**: locks (exam dates, deliveries), habits (study sessions N per week before a date), hours per area (School), the nightly reschedule (study blocks that slip), IRIS (the School conversation gets the exam calendar and guides as context).

**Open questions**
- Where the material and the notes live (the Obsidian vault is the natural place for notes) and in what formats (PDF slides, recordings, notes).
- Whether the dashboard is a tab in El Boceto (needs a place to store grades: inside the plan or its own table) or a generated note in the vault.
- How grades get in: typed by hand, or imported from the school's portal.
- Whether the guides are generated on demand in Claude Code (simplest first step) or by a feature in the app.
