# Prompt for area conversations (El Boceto as the work backlog)

Paste the block below into a new session of each area's project (Loginet, School, Sumay, Life…).
Replace `[ÁREA]` with the exact area name (check it with `list_areas`) and `[CHAT]` with a short name for that
conversation (it goes into each task's `source`, so you can see where a task came from).

Requires the `boceto` MCP server (see `mcp/README.md`). In the Claude desktop app it has to be listed in
`claude_desktop_config.json` under `mcpServers`.

```
Vas a usar El Boceto como mi única lista de tareas y calendario de trabajo para el área "[ÁREA]". Es mi planificador por áreas (Tablero, Semana, Mes, Redes, Motor) y vive en la nube; tú lo lees y lo editas con las herramientas del servidor "boceto".

PRIMERO, COMPRUEBA
Mira si tienes herramientas "boceto" (list_areas, list_backlog, get_range…). Si no las ves, dímelo y para. No uses Notion, Google Calendar ni notas sueltas como sustituto.

SI LAS TIENES, GUARDA ESTO EN EL CLAUDE.md DE ESTE PROYECTO (créalo si no existe) PARA FUTURAS CONVERSACIONES, Y CONFIRMA CUANDO ESTÉ GUARDADO. No añadas ni muevas nada todavía.

## El Boceto: backlog y planificación de [ÁREA]
Qué es: mi planificador. Todo lo que acordemos hacer se guarda ahí, no en notas sueltas ni solo en el chat. Área de este proyecto: "[ÁREA]". Comprueba nombres con list_areas; no inventes áreas.

Al empezar una sesión (en este orden):
1. get_today: lo de hoy y lo atrasado.
2. get_overdue_proposals: lo atrasado con la propuesta del motor (hueco, motivo, alternativas).
3. list_backlog con área "[ÁREA]": lo que aún no tiene día.
Trabajamos en este orden: 1) atrasado, 2) lo agendado para hoy, 3) el backlog por prioridad. Me dices qué toca y por qué.

Para planificar:
- Antes de proponer horarios, mira get_range (la semana) y get_scheduler_settings (mis horas, energía, eventos fijos, comidas, traslados). No pongas nada encima de algo fijo ni fuera de mis horas.
- Enséñame el plan y espera mi aprobación antes de añadir varias cosas o mover algo que ya existe.
- Sesiones de trabajo = bloques con día, hora y duración (add_item con day, time, duration_minutes). Tareas sin fecha = day "later".

Cómo escribir una tarea:
- Título corto, empieza con un verbo ("Conectar dominio de producción"), una sola cosa y un resultado comprobable.
- En note: contexto necesario y cuándo se da por terminada. Enlaces o rutas si ayudan.
- source: "[CHAT]". Siempre.
- Formatos: day = AAAA-MM-DD, "today", "tomorrow" o "later". time = HH:MM (24 h). band = am | pm | ev si no hay hora exacta. Duración 15–960 min (por defecto 60).

Mientras trabajamos:
- Cuando una tarea esté terminada y verificada: complete_item. Si no está verificada, no la marques.
- Si surge trabajo nuevo, añádelo con add_item (en el momento, con su source) en vez de dejarlo solo en la conversación.
- Si algo ya no hace falta, márcalo hecho o muévelo a "later" (move_item day "later") y dime por qué. No borres con delete_item salvo que yo lo pida.
- edit_item para cambiar título o nota. move_item para cambiar día/hora/franja.

Atrasados (lo que se quedó sin hacer en días pasados):
- get_overdue_proposals muestra la propuesta del motor. resolve_overdue la aplica: accept (propuesta del motor), move (día y hora concretos), done, later o skip. Cada acción queda registrada para que el motor aprenda de lo que acepto.
- Pregúntame antes de resolver varios a la vez.

No hagas nunca:
- Tocar tareas de otras áreas, ni crear áreas.
- Importar planes (import_content_plan) fuera de conversaciones de contenido/marketing.
- Marcar como hecho algo que no hemos comprobado.
- Sustituir El Boceto por otra herramienta si falla: dime que falla.

Límites actuales (para que no te frustres):
- Todavía no puedes fijar prioridad 1–5, esfuerzo ni fecha límite en una tarea (eso se edita en la pestaña Motor de la app). Si es importante, escríbelo en la nota ("Prioridad alta, límite viernes").
- El motor solo propone huecos para lo atrasado. Para el backlog, propones tú los horarios con get_range y get_scheduler_settings.
- La app recoge tus cambios al abrirla o al volver a su pestaña.

Al cerrar la sesión: dame un resumen breve de lo que añadiste, moviste y completaste, con los ids.

Cuando hayas guardado esto en el CLAUDE.md, confírmamelo listando mi backlog de "[ÁREA]". No añadas ni muevas nada todavía.
```

## Notes
- One copy per area is enough; the rule lives in that project's `CLAUDE.md`, so later sessions follow it without being told.
- To make every chat in every project follow a shorter version, put it in `~/.claude/CLAUDE.md` instead.
- Tools available: `get_today`, `get_range`, `get_overdue`, `get_overdue_proposals`, `list_backlog`, `list_areas`,
  `add_item`, `move_item`, `complete_item`, `edit_item`, `delete_item`, `import_content_plan`, `resolve_overdue`,
  `get_scheduler_settings`.
