# Content plan format (`boceto-content-plan`)

A JSON file that El Boceto imports from the ⋮ menu → **PLAN DE CONTENIDO** → *Importar plan de contenido (.json)*.
Any Claude conversation (e.g. the marketing one) can write it. A working example is
[`sumay-instagram.plan.json`](./sumay-instagram.plan.json).

Importing is idempotent: blocks already in the app (matched by `id` + `key`) are never touched again, so edits and
deletions made in the app survive a re-import. Reels already in the stack keep their order, and their texts are refreshed.

```jsonc
{
  "format": "boceto-content-plan",      // required, exactly this
  "version": 1,
  "id": "sumay-instagram",              // required, stable: it prefixes every block id
  "area": "Sumay",                      // required: the main area (column) name; created if missing
  "label": "Sumay · Instagram",         // shown on the import button

  "stack": {                            // optional: an ordered list of posts with automatic dates
    "title": "Reels",
    "start": "2026-11-17",              // first slot (YYYY-MM-DD)
    "weekdays": [2, 5],                 // 0 = Sunday … 6 = Saturday; slot 1 is the first one on/after `start`
    "at": "19:00",                      // hour every post goes out
    "minutes": 30,                      // block length in the calendar
    "reels": [                          // in publishing order; dates follow the position
      {
        "id": "p1",                     // required, stable
        "short": "Intro V1",            // name on the stack card and the calendar block
        "title": "Intro: I'm sending 20 invitations…",   // longer name (tooltip of the block)
        "script": "First line = the hook (what you say in the first 2 seconds).\nThe rest of the lines = the body.",
        "cta": "Reserve your spot: link in bio",
        "caption": "Caption of the post, then the hashtags.\n\n#coffeeinparis #buildinpublic",
        "posted": false                 // optional: true when it is already published
        // Other fields (hook, kind, format, screen, note, draft…) are kept in the file but the app does not show them.
      }
    ]
  },

  "items": [                            // other dated blocks (stories, filming, reports…)
    {
      "key": "story-w0-mon",            // required, unique inside the plan
      "area": "Social Media",           // optional: another area for this block (created if missing); default is the plan's `area`
      "day": "2026-11-16",              // required
      "from": "09:00", "to": "10:00",   // optional: without `from` the block has no hour ("sin hora")
      "text": "Stories: …",             // required
      "note": "…",                      // optional tooltip
      "film": 0                         // optional: marks a "Film + edit" block of week 0; its text
                                        // names the Reels due the following week and follows the stack order
    }
  ]
}
```

In the app, the stack appears in the left panel (plan views). Drag a card or use the arrows to reorder: the Reel blocks
move to the new dates. Tick a card when it is posted: it stays on its date and is skipped when reordering.

## What the user does with a Reel in the app
- Clicking a Reel (stack card, or its block in Día completo, Tablero, Semana or Mes) opens one panel with four editable
  fields: **Hook** (first line of `script`), **Body** (the rest of `script`), **Call to action** (`cta`) and
  **Caption and hashtags** (`caption`). The user edits them directly there.
- Edits are kept apart from the imported text: importing the same file again never overwrites them.

## Getting the final text back to the content conversation
⋮ menu → **PLAN DE CONTENIDO** → *Exportar plan con mis ediciones (.json)* downloads `<id>.plan.json` in this same format:
Reels in the current stack order, with the user's edits applied to `script` / `cta` / `caption`, `"posted": true` on the
published ones, and every other block as it is now. Give that file to the conversation: it is the source of truth for
the final texts. When that conversation writes a new version of the plan, keep the same `id`, `key` and Reel `id`s so
the import matches the existing blocks.

