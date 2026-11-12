/* ===== UI ===== */
const STORE = 'motor-boceto-prototype-v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };

let S = (() => { try { const j = JSON.parse(localStorage.getItem(STORE)); if (j && j.profile && j.tasks) return j; } catch (e) { /* storage unavailable */ } return defaultState(); })();
let save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
let tab = 'perfil';
let selId = null;
let baseSig = null;
let R = runEngine(S);

const TABS = [['perfil', 'Perfil'], ['fijo', 'Calendario fijo'], ['areas', 'Áreas'], ['tareas', 'Tareas'], ['pesos', 'Pesos'], ['simulacion', 'Simulación'], ['arquitectura', 'Arquitectura']];
const ac = (area) => { const i = S.areas.indexOf(area); return `var(--a${i < 0 ? 6 : i % 8})`; };
const allAreas = () => [...new Set([...S.areas, ...S.fixed.map((f) => f.area), ...S.tasks.map((t) => t.area)].filter(Boolean))];

/* --- small form builders --- */
const tag = (kind) => (kind === 'on' ? '<span class="tag on">en simulación</span>' : kind === 'plan' ? '<span class="tag plan">planeado</span>' : '');
const f = (label, control, kind) => `<label class="f"><span class="l">${label}${tag(kind)}</span>${control}</label>`;
const iText = (path, v) => `<input type="text" data-path="${path}" data-t="str" value="${esc(v)}">`;
const iTime = (path, v) => `<input type="time" data-path="${path}" data-t="str" value="${esc(v)}">`;
const iDate = (path, v, rr) => `<input type="date" data-path="${path}" data-t="str" value="${esc(v)}"${rr ? ' data-rr="1"' : ''}>`;
const iNum = (path, v, min, max, step = 1) => `<input type="number" data-path="${path}" data-t="num" value="${esc(v)}" min="${min}" max="${max}" step="${step}">`;
const iChk = (path, v, label, rr) => `<span class="chk"><input type="checkbox" data-path="${path}" data-t="bool"${v ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</span>`;
const iSel = (path, v, opts, num) => `<select data-path="${path}" data-t="${num ? 'num' : 'str'}">${opts.map(([val, lab]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
const win = (title, body, extra = '') => `<section class="win"><h2><span>${title}</span>${extra}</h2><div class="body">${body}</div></section>`;
const dayChips = (days, actPrefix) => `<div class="chips">${DAYN.map((d, i) => `<button data-act="${actPrefix}:${i}" aria-pressed="${days[i] === true || (Array.isArray(days) && typeof days[0] === 'number' && days.includes(i))}">${d}</button>`).join('')}</div>`;

/* --- panels --- */
const panels = {
  perfil() {
    const P = S.profile;
    const wakeH = (toMin(P.bed) - toMin(P.wake)) / 60;
    return `<p class="note">Lo que casi nunca cambia. El motor lo usa para saber qué horas existen de verdad antes de repartir nada. Datos de ejemplo: cámbialos por los tuyos.</p>
    <div class="cols"><div class="stack">
      ${win('Sueño', `<div class="grid2">${f('Me levanto', iTime('profile.wake', P.wake), 'on')}${f('Me acuesto', iTime('profile.bed', P.bed), 'on')}</div><div class="stat">Horas despierto al día: <b>${wakeH.toFixed(1)} h</b></div>`)}
      ${win('Comidas', P.meals.map((m, i) => `<div class="row">${iChk(`profile.meals.${i}.on`, m.on, '')}<input type="text" data-path="profile.meals.${i}.name" data-t="str" value="${esc(m.name)}">${iTime(`profile.meals.${i}.start`, m.start)}${iNum(`profile.meals.${i}.dur`, m.dur, 5, 180, 5)}</div>`).join('') + `<div class="stat">Casilla · nombre · hora · minutos. ${tag('on')}</div>`)}
      ${win('Disponibilidad', `<div class="grid2">${f('Puedo trabajar desde', iTime('profile.window.from', P.window.from), 'on')}${f('hasta', iTime('profile.window.to', P.window.to), 'on')}</div>
        <div><div class="stat" style="margin-bottom:5px">Días abiertos para trabajo flexible ${tag('on')}</div>${dayChips(P.open, 'open')}</div>`)}
    </div><div class="stack">
      ${win('Energía y límites', `
        ${['am', 'pm', 'ev'].map((k, i) => `<div class="sl"><div class="t"><span>Energía ${['de mañana (hasta 13:00)', 'de tarde (13:00–19:00)', 'de noche (desde 19:00)'][i]}</span><span class="val">${P.energy[k]}</span></div><input type="range" min="1" max="5" step="1" data-path="profile.energy.${k}" data-t="num" value="${P.energy[k]}"></div>`).join('')}
        <div class="grid2">${f('Máx. horas profundas / día', iNum('profile.deepCap', P.deepCap, 1, 12, 0.5), 'on')}${f('Colchón entre tareas (min)', iNum('profile.buffer', P.buffer, 0, 60, 5), 'on')}${f('Colchón tras algo fijo (min)', iNum('profile.bufferFixed', P.bufferFixed, 0, 60, 5), 'on')}</div>`)}
      ${win('Traslados', `${Object.keys(P.places).map((k) => `<div class="grid2" style="grid-template-columns:1fr 100px;align-items:center"><span>${k}</span>${iNum(`profile.places.${k}`, P.places[k], 0, 180, 5)}</div>`).join('')}<div class="stat">Minutos de ida. Se reservan antes y después de lo fijo, y se suman a las tareas de ese lugar. ${tag('on')}</div>`)}
      ${win('Resumen', `<div class="stat">Horas libres para tareas flexibles esta semana: <b id="freeH">${freeHours(R.G).toFixed(1)} h</b></div>`)}
    </div></div>`;
  },
  fijo() {
    return `<p class="note">Lo que no se mueve: clases, turnos, citas. Se repite cada semana en los días elegidos. El motor reserva también el traslado y el colchón.</p>
    <div class="stack">${S.fixed.map((x, i) => `<div class="card"><div class="head">${iText(`fixed.${i}.name`, x.name)}<button class="small ghost" data-act="delFixed:${i}">Quitar</button></div>
      ${dayChips(x.days, `fday:${i}`)}
      <div class="grid2">${f('Desde', iTime(`fixed.${i}.from`, x.from), 'on')}${f('Hasta', iTime(`fixed.${i}.to`, x.to), 'on')}${f('Lugar', iSel(`fixed.${i}.place`, x.place, Object.keys(S.profile.places).map((p) => [p, p])), 'on')}${f('Área', iSel(`fixed.${i}.area`, x.area, allAreas().map((p) => [p, p])), 'on')}</div>
      ${iChk(`fixed.${i}.optional`, x.optional, 'Opcional: el motor podrá soltarlo si la semana no cabe') } ${tag('plan')}</div>`).join('') || '<div class="empty">Nada fijo todavía.</div>'}
      <div><button class="primary" data-act="addFixed">+ Añadir algo fijo</button></div></div>`;
  },
  areas() {
    const n = S.areas.length;
    return `<p class="note">La pila decide quién gana cuando dos cosas compiten por el mismo hueco. Arriba pesa más. La posición se convierte en un valor de 0 a 1 que se multiplica por el peso “Lugar del área” (pestaña Pesos).</p>
    <div class="arealist">${S.areas.map((a, i) => { const v = areaScore(S, a); const c = S.tasks.filter((t) => t.area === a && !t.done).length;
      return `<div class="arow"><span class="rk">${i + 1}</span><span class="dot" style="background:${ac(a)}"></span><span><b>${esc(a)}</b> <span class="stat">· ${c} tareas abiertas</span></span><span class="bar" title="Valor ${v.toFixed(2)}"><i style="width:${(v * 100).toFixed(0)}%"></i></span><span><button class="small" data-act="areaUp:${i}" ${i === 0 ? 'disabled' : ''}>↑</button> <button class="small" data-act="areaDown:${i}" ${i === n - 1 ? 'disabled' : ''}>↓</button></span></div>`; }).join('')}</div>
    <p class="note" style="margin-top:12px">Cuota semanal mínima por área ${tag('plan')}: horas que cada área debería recibir cada semana aunque no sea la más prioritaria. Todavía no entra en el cálculo.</p>`;
  },
  tareas() {
    const optsTasks = [['', '—'], ...S.tasks.map((t) => [t.id, t.title])];
    return `<p class="note">Todo lo que el motor sabe de cada tarea. “Día original” es donde estaba planeada: si es anterior a hoy, la tarea está atrasada.</p>
    <div class="stack">${S.tasks.map((t, i) => `<div class="card${t.done ? ' done' : ''}"><div class="head"><span class="dot" style="background:${ac(t.area)}"></span>${iText(`tasks.${i}.title`, t.title)}<button class="small ghost" data-act="delTask:${i}">Quitar</button></div>
      <div class="grid2">
        ${f('Área', iSel(`tasks.${i}.area`, t.area, allAreas().map((p) => [p, p])), 'on')}
        ${f('Prioridad 1–5', iSel(`tasks.${i}.prio`, t.prio, [1, 2, 3, 4, 5].map((p) => [p, String(p)]), true), 'on')}
        ${f('Esfuerzo', iSel(`tasks.${i}.effort`, t.effort, Object.entries(EFFORT).map(([k, v]) => [k, v.label])), 'on')}
        ${f('Duración probable (min)', iNum(`tasks.${i}.dur`, t.dur, 5, 600, 5), 'on')}
        ${f(t.fixed ? 'Fecha' : 'Día original', iDate(`tasks.${i}.orig`, t.orig), 'on')}
        ${t.fixed ? f('Hora', iTime(`tasks.${i}.at`, t.at || '09:00'), 'on') : f('Fecha límite', iDate(`tasks.${i}.dl`, t.dl), 'on')}
        ${f('Lugar', iSel(`tasks.${i}.place`, t.place, Object.keys(S.profile.places).map((p) => [p, p])), 'on')}
        ${t.fixed ? '' : f('No antes de', iDate(`tasks.${i}.notBefore`, t.notBefore), 'on')}
      </div>
      <div class="chips" style="gap:14px">
        ${iChk(`tasks.${i}.fixed`, t.fixed, 'Fija (no se mueve)', true)}
        ${t.fixed ? '' : iChk(`tasks.${i}.dlHard`, t.dlHard, 'Límite duro')}
        ${iChk(`tasks.${i}.done`, t.done, 'Hecha')}
      </div>
      <div class="grid2">
        ${f('Divisible', iChk(`tasks.${i}.split`, t.split, 'Se puede partir'), 'plan')}
        ${f('Bloque mínimo (min)', iNum(`tasks.${i}.chunk`, t.chunk ?? 30, 15, 240, 15), 'plan')}
        ${f('Depende de', iSel(`tasks.${i}.dep`, t.dep || '', optsTasks.filter(([v]) => v !== t.id)), 'plan')}
      </div></div>`).join('')}
      <div><button class="primary" data-act="addTask">+ Añadir tarea</button></div></div>`;
  },
  pesos() {
    const slider = (w) => `<div class="sl"><div class="t"><span>${w.label} ${tag('on')}</span><span class="val">${S.weights[w.id]}</span></div><input type="range" min="0" max="100" step="5" data-path="weights.${w.id}" data-t="num" value="${S.weights[w.id]}"><div class="h">${w.hint}</div></div>`;
    return `<p class="note">El motor decide en dos pasos. <b>A</b>: quién elige primero. <b>B</b>: en qué hueco cae cada tarea. Mueve un peso y mira a la derecha qué decisiones cambian (en ocre).</p>
    <div class="cols"><div class="stack">
      ${win('A · Quién va primero', WEIGHTS.filter((w) => w.stage === 'A').map(slider).join(''))}
      ${win('B · Dónde cae', WEIGHTS.filter((w) => w.stage === 'B').map(slider).join(''))}
      ${win('Todavía sin cablear', PLANNED.map(([a, b]) => `<div><b>${a}</b> ${tag('plan')}<div class="stat">${b}</div></div>`).join(''))}
      <div><button data-act="resetWeights">Restablecer pesos</button></div>
    </div><div class="stack">${win('Decisiones', '<div id="decisions"></div>', '<button class="small" data-act="setBase">Fijar como referencia</button>')}</div></div>`;
  },
  simulacion() {
    return `<p class="note">Hoy de ejemplo: jueves 12 de noviembre, 10:00. Esto es lo que el motor haría con las tareas pendientes en los próximos 7 días. Pulsa un bloque o una decisión para ver por qué.</p>
    <div id="simout"></div>`;
  },
  arquitectura() {
    const steps = [
      ['1 · Disparador', 'on', 'Fin de día, tarea no hecha, evento fijo nuevo que choca, tarea que se alarga, o “replanificar”.', 'Entra: un evento. Sale: qué tareas hay que recolocar.'],
      ['2 · Reglas duras', 'on', 'Lo que nunca puede pasar: sueño, clases, comidas, traslados, fecha límite dura, “no antes de”.', 'Sale: la cuadrícula de huecos libres.'],
      ['3 · Turno (etapa A)', 'on', 'Ordena las tareas por urgencia: prioridad, área, fecha límite, atraso.', 'Sale: la cola de quién elige primero.'],
      ['4 · Candidatos y puntuación (etapa B)', 'on', 'Cada hueco válido recibe una puntuación con los pesos: cercanía, energía, holgura, tope profundo, reparto.', 'Sale: el mejor hueco y las alternativas.'],
      ['5 · Sentido común con historial', 'plan', 'Compara con lo que de verdad has cumplido: ¿suele salir bien un sábado por la tarde? Baja la puntuación o avisa.', 'Necesita la capa de historial.'],
      ['6 · Salida explicable', 'on', 'Lista de cambios con el motivo de cada uno, y cuán segura es la decisión. Lo seguro y pequeño se aplica; lo demás se propone.', 'Sale: diff + motivos.'],
      ['7 · Aprendizaje', 'plan', 'Registra si aceptas, editas o rechazas, y qué pasó de verdad. Ajusta duraciones y pesos con estadística simple.', 'Empieza registrando, aunque aún no aprenda.']
    ];
    return `<p class="note">Cómo encaja todo. Lo marcado “en simulación” funciona en este prototipo con datos de ejemplo; lo “planeado” aún no.</p>
    <h3 class="stage">Tubería de decisión</h3>
    <div class="pipe">${steps.map(([t, k, d, io]) => `<div class="step"><h3><span>${t}</span>${tag(k)}</h3><p>${d}</p><p class="mono">${io}</p></div>`).join('')}</div>
    <h3 class="stage" style="margin-top:18px">Los datos, en seis capas</h3>
    <div class="layers">
      <div class="layer"><b>1 · Perfil</b><span>Sueño, comidas, ventana de trabajo, energía, topes, colchones, traslados. Cambia poco.</span></div>
      <div class="layer"><b>2 · Calendario fijo</b><span>Clases, turnos, citas, con lugar y si son opcionales.</span></div>
      <div class="layer"><b>3 · Tareas</b><span>Fija o flexible, prioridad, límite duro/blando, duración, esfuerzo, lugar, divisible, dependencias, “vinculada a ritmo”.</span></div>
      <div class="layer"><b>4 · Mapa de tiempo</b><span>La semana como cuadrícula de 30 min menos lo bloqueado. Se calcula, no se guarda.</span></div>
      <div class="layer"><b>5 · Historial</b><span>Registro de eventos: planeado vs real, duración real, saltos, cada reprogramación y si la aceptaste. Es lo más valioso: se registra desde el día uno.</span></div>
      <div class="layer"><b>6 · Preferencias aprendidas</b><span>Pesos y estadísticas derivadas del historial. Aparte del perfil porque cambian solas.</span></div>
    </div>
    <h3 class="stage" style="margin-top:18px">Dónde vive en El Boceto</h3>
    <div class="layers">
      <div class="layer"><b>src/lib/scheduler/</b><span>Módulo puro (sin pantalla): <span class="mono">profile · grid · constraints · urgency · scoring · planner · explain · history</span>. Lo comparten la app y el servidor MCP, igual que el resto del plan.</span></div>
      <div class="layer"><b>Pruebas y repetición</b><span>Cada semana pasada se puede volver a pasar por una versión nueva de las reglas y comprobar si habría decidido mejor.</span></div>
      <div class="layer"><b>Pantallas</b><span>Estas ventanas, dentro de la app: Perfil, Calendario fijo, Áreas, Tareas, Pesos y Simulación. Los datos van en el mismo plan que se sincroniza con Supabase.</span></div>
      <div class="layer"><b>Claude</b><span>Solo para lo ambiguo (“si responde Sam”), para explicar propuestas y para la rutina de la mañana. El núcleo no lo necesita.</span></div>
    </div>`;
  }
};

/* --- live regions --- */
function decisionsHtml(res, sel) {
  const rows = res.placed.map((p) => {
    const at = slotLabel(res.G, p.choice);
    const ch = baseSig && baseSig[p.task.id] && baseSig[p.task.id] !== at;
    return `<button class="drow${ch ? ' chg' : ''}${sel === p.task.id ? ' sel' : ''}" data-act="sel:${p.task.id}"><span class="n">#${p.rank + 1}</span><span class="tt">${esc(p.task.title)}</span><span class="at">${at}${ch ? ` (antes ${baseSig[p.task.id]})` : ''}</span></button>`;
  });
  const no = res.unplaced.map((p) => `<button class="drow no" data-act="sel:${p.task.id}"><span class="n">#${p.rank + 1}</span><span class="tt">${esc(p.task.title)}</span><span class="at">no cabe</span></button>`);
  const kept = res.keptFixed.map((k) => `<div class="drow" style="cursor:default"><span class="n">fija</span><span class="tt">${esc(k.task.title)}</span><span class="at">${dayLabel(res.G.days[k.d])} ${fmt(k.start)}</span></div>`);
  return `<div class="dec">${rows.join('') || '<div class="empty">Nada pendiente.</div>'}${no.join('')}${kept.join('')}</div>`;
}

function partsTable(parts, signed) {
  const max = Math.max(0.0001, ...parts.map((p) => Math.abs(p.contrib)));
  return `<table class="parts"><thead><tr><th>Factor</th><th>Valor</th><th>Peso</th><th>Aporte</th><th></th></tr></thead><tbody>${parts.map((p) => `<tr><td>${esc(p.label)}</td><td class="n">${p.value.toFixed(2)}</td><td class="n">${p.weight}</td><td class="n">${p.contrib >= 0 && signed ? '+' : ''}${p.contrib.toFixed(1)}</td><td style="width:34%"><div class="cb${p.contrib < 0 ? ' neg' : ''}" style="width:${(Math.abs(p.contrib) / max * 100).toFixed(0)}%"></div></td></tr>`).join('')}</tbody></table>`;
}

function detailHtml(res, id) {
  const p = res.placed.find((x) => x.task.id === id);
  const u = res.unplaced.find((x) => x.task.id === id);
  if (!p && !u) return '<div class="empty">Elige una decisión para ver el porqué.</div>';
  const t = (p || u).task; const urg = (p || u).urgency;
  let html = `<h3 style="margin:0;font:700 1.05rem var(--f-head)">${esc(t.title)}</h3><div class="stat">${esc(t.area)} · prioridad ${t.prio} · ${EFFORT[t.effort].label.toLowerCase()} · ${t.dur} min${t.dl ? ` · límite ${t.dl}${t.dlHard ? ' (duro)' : ''}` : ''}</div>`;
  html += `<div class="stage">A · Turno #${(p || u).rank + 1}</div>${partsTable(urg.parts, true)}<div class="stat">Urgencia total: <b>${urg.total.toFixed(1)}</b></div>`;
  if (u) return html + `<div class="stage">B · Sin hueco</div><div class="empty">${esc(u.reason)} Propuesta: pasa a “Más adelante” y avisa; si el límite es duro, hay un conflicto que decidir.</div>`;
  const best = p.choice;
  html += `<div class="stage">B · Por qué ${slotLabel(res.G, best)}–${fmt(best.start + p.task.effDur)}</div>${partsTable(best.parts, true)}<div class="stat">Puntuación: <b>${best.total.toFixed(1)}</b> · ${p.candidates} huecos válidos${p.commute ? ` · incluye ${p.commute} min de traslado` : ''}</div>`;
  if (p.alts.length) {
    html += `<div class="stage">Alternativas descartadas</div>${p.alts.map((a) => {
      const diffs = a.parts.map((q, i) => ({ label: q.label, d: q.contrib - best.parts[i].contrib })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
      return `<div class="alt"><span>${slotLabel(res.G, a)}</span><span class="mono">Δ ${(a.total - best.total).toFixed(1)} · sobre todo: ${esc(diffs.label)} (${diffs.d >= 0 ? '+' : ''}${diffs.d.toFixed(1)})</span></div>`;
    }).join('')}`;
  }
  return html;
}

function weekHtml(res, sel) {
  const { G, placed, keptFixed } = res;
  const own = G.days.map(() => Array(G.n).fill(null));
  placed.forEach((p) => { for (let k = p.choice.k0; k < p.choice.k0 + p.need; k++) own[p.choice.d][k] = { p, first: k === p.choice.k0 }; });
  let cells = '<div class="dh"></div>' + G.days.map((d, i) => `<div class="dh${i === 0 ? ' today' : ''}">${dayLabel(d)}${i === 0 ? ' · hoy' : ''}</div>`).join('');
  for (let k = 0; k < G.n; k++) {
    const m = G.wake + k * SLOT;
    cells += `<div class="hr">${k % 2 === 0 ? fmt(m) : ''}</div>`;
    for (let d = 0; d < 7; d++) {
      const o = own[d][k]; const b = G.blocked[d][k]; const why = res.used[d][k];
      if (o) { cells += `<div class="c tk${sel === o.p.task.id ? ' sel' : ''}" style="--ac:${ac(o.p.task.area)}" data-act="sel:${o.p.task.id}" title="${esc(o.p.task.title)}">${o.first ? esc(o.p.task.title) : ''}</div>`; continue; }
      if (b) {
        const kind = b.startsWith('fijo:') ? 'fix' : b === 'comida' ? 'meal' : b === 'traslado' ? 'trav' : b === 'colchón' ? 'buf' : b === 'descanso' ? 'rest' : b === 'pasado' ? 'past' : 'out';
        const first = kind === 'fix' && !(k > 0 && G.blocked[d][k - 1] === b);
        cells += `<div class="c ${kind}" title="${esc(b.replace('fijo:', ''))}">${first ? esc(b.slice(5)) : ''}</div>`; continue;
      }
      cells += `<div class="c ${why === 'buf' ? 'buf' : 'free'}"></div>`;
    }
  }
  return `<div class="wk"><div class="wkg">${cells}</div></div>
  <div class="legend"><span><i style="background:var(--card)"></i>libre</span><span><i style="background:color-mix(in srgb, var(--a0) 36%, var(--card))"></i>tarea colocada</span><span><i style="background:color-mix(in srgb, var(--muted) 38%, var(--card))"></i>fijo</span><span><i style="background:var(--blocked)"></i>comida</span><span><i style="background:repeating-linear-gradient(135deg,var(--blocked),var(--blocked) 3px,var(--hatch) 3px,var(--hatch) 6px)"></i>traslado</span><span><i style="background:var(--hatch)"></i>fuera de horario / descanso / pasado</span><span><i style="background:color-mix(in srgb, var(--accent) 8%, var(--card))"></i>colchón</span></div>`;
}

function drawLive() {
  R = runEngine(S);
  const fh = $('#freeH'); if (fh) fh.textContent = `${freeHours(R.G).toFixed(1)} h`;
  const d = $('#decisions'); if (d) d.innerHTML = decisionsHtml(R, selId);
  const s = $('#simout');
  if (s) s.innerHTML = `<div class="cols" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)"><div class="stack">${weekHtml(R, selId)}</div><div class="stack">${win('Decisiones', decisionsHtml(R, selId))}${win('Por qué', detailHtml(R, selId))}</div></div>`;
}

/* --- render + events --- */
function render() {
  tab = (location.hash || '#perfil').slice(1);
  if (!panels[tab]) tab = 'perfil';
  $('#tabs').innerHTML = TABS.map(([id, l]) => `<a href="#${id}"${id === tab ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  $('#panel').innerHTML = panels[tab]();
  if (tab === 'pesos' && !baseSig) baseSig = placedSignature(runEngine(S));
  drawLive();
}

function commit(el) {
  const t = el.dataset.t; let v = el.value;
  if (t === 'num') { v = Number(v); if (Number.isNaN(v)) v = 0; } else if (t === 'bool') v = el.checked;
  setPath(S, el.dataset.path, v);
  save();
  if (el.type === 'range') { const val = el.closest('.sl') && el.closest('.sl').querySelector('.val'); if (val) val.textContent = v; }
  if (el.dataset.rr) { render(); return; }
  drawLive();
}

document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.path) commit(e.target); });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const [a, x, y] = b.dataset.act.split(':'); const i = Number(x);
  if (a === 'sel') { selId = x; drawLive(); return; }
  if (a === 'open') S.profile.open[i] = !S.profile.open[i];
  else if (a === 'fday') { const days = S.fixed[i].days; const d = Number(y); S.fixed[i].days = days.includes(d) ? days.filter((q) => q !== d) : [...days, d].sort(); }
  else if (a === 'addFixed') S.fixed.push({ id: 'f' + Date.now(), name: 'Nuevo evento fijo', days: [0], from: '09:00', to: '10:00', place: 'Casa', area: S.areas[0] || 'Life', optional: false });
  else if (a === 'delFixed') S.fixed.splice(i, 1);
  else if (a === 'addTask') S.tasks.push({ id: 't' + Date.now(), title: 'Nueva tarea', area: S.areas[0] || 'Life', prio: 3, fixed: false, orig: DEMO_TODAY, dl: '', dlHard: false, dur: 60, effort: 'light', place: 'Casa', notBefore: '', done: false });
  else if (a === 'delTask') S.tasks.splice(i, 1);
  else if (a === 'areaUp' || a === 'areaDown') { const j = a === 'areaUp' ? i - 1 : i + 1; if (j >= 0 && j < S.areas.length) [S.areas[i], S.areas[j]] = [S.areas[j], S.areas[i]]; }
  else if (a === 'resetWeights') S.weights = Object.fromEntries(WEIGHTS.map((w) => [w.id, w.def]));
  else if (a === 'setBase') baseSig = placedSignature(runEngine(S));
  else if (a === 'reset') { S = defaultState(); baseSig = null; selId = null; }
  else if (a === 'json') { const d = $('#jsonbox'); d.hidden = !d.hidden; $('#jsonta').value = JSON.stringify(S, null, 2); return; }
  else if (a === 'copy') {
    const ta = $('#jsonta'); ta.select();
    const ok = () => { b.textContent = 'Copiado'; setTimeout(() => { b.textContent = 'Copiar'; }, 1500); };
    try { navigator.clipboard.writeText(ta.value).then(ok, () => { b.textContent = 'Selecciona y copia'; }); } catch (err) { b.textContent = 'Selecciona y copia'; }
    return;
  }
  save(); render();
});
window.addEventListener('hashchange', render);
render();
