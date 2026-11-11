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
  "area": "Sumay",                      // required: the area (column) name; created if missing
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
        "short": "Intro V1",            // name on the stack card and calendar block
        "hook": "…", "kind": "connection", "format": "Reel · about 24 s",
        "title": "…", "script": "…", "screen": ["0:00 …"], "cta": "…", "caption": "…", "note": "…",
        "draft": false                  // true shows a "borrador" warning
      }
    ]
  },

  "items": [                            // other dated blocks (stories, filming, reports…)
    {
      "key": "story-w0-mon",            // required, unique inside the plan
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
