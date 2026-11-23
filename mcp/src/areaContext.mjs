// What an area's conversation also receives besides the launch message: the project's own rules (CLAUDE.md). The launcher reads the part about
// El Boceto / IRIS and keeps it in the plan (plan.devContext[areaId]) so the web page can show it next to the message. Read-only.
import fs from 'node:fs';
import path from 'node:path';

// The section(s) of a CLAUDE.md that talk about El Boceto or IRIS: from a heading that mentions it to the next heading of the same level.
export function extractBocetoRules(md = '') {
  const lines = String(md).replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!h || !/boceto|iris/i.test(h[2])) continue;
    const level = h[1].length;
    const block = [lines[i]];
    for (let j = i + 1; j < lines.length; j += 1) {
      const n = /^(#{1,6})\s/.exec(lines[j]);
      if (n && n[1].length <= level) break;
      block.push(lines[j]);
      i = j;
    }
    out.push(block.join('\n').trim());
  }
  const text = out.join('\n\n').trim();
  return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
}
// Does it tell the agent to check the calendar at the start of every session?
export const asksForCalendar = (text = '') => /get_today|get_overdue|list_backlog|get_range/i.test(String(text));

export function readAreaRules(dir) {
  for (const f of ['CLAUDE.md', path.join('.claude', 'CLAUDE.md')]) {
    try {
      const md = fs.readFileSync(path.join(dir, f), 'utf8');
      const rules = extractBocetoRules(md);
      return { file: f, rules, asksCalendar: asksForCalendar(rules) };
    } catch { /* try the next one */ }
  }
  return { file: '', rules: '', asksCalendar: false };
}
