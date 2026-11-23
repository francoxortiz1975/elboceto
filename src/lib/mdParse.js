// A small, safe Markdown reader: text -> blocks (headings, paragraphs, lists, tables, quotes, code, rules) with inline spans.
// It produces data, never HTML, so whatever a file contains cannot run anything. Links are kept only when they are http(s).

const INLINE_SRC = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(__[^_\n]+?__)|(\*[^*\n]+?\*)|(_[^_\n]+?_)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s)<]+)/;

export function parseInline(src = '') {
  const out = [];
  let last = 0;
  let m;
  const text = String(src);
  const re = new RegExp(INLINE_SRC.source, 'g'); // its own lastIndex: parseInline calls itself for nested spans
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    const tok = m[0];
    if (m[1]) out.push({ t: 'code', v: tok.slice(1, -1) });
    else if (m[2] || m[3]) out.push({ t: 'b', c: parseInline(tok.slice(2, -2)) });
    else if (m[4] || m[5]) out.push({ t: 'i', c: parseInline(tok.slice(1, -1)) });
    else if (m[6]) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (mm && /^https?:\/\//i.test(mm[2])) out.push({ t: 'a', href: mm[2], c: parseInline(mm[1]) });
      else out.push({ t: 'text', v: mm ? mm[1] : tok });
    } else out.push({ t: 'a', href: tok, c: [{ t: 'text', v: tok }] });
    last = m.index + tok.length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');
const listMark = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function parseMarkdown(src = '') {
  const lines = String(src).replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i += 1; }
      i += 1;
      blocks.push({ t: 'code', lang: fence[1].trim(), v: body.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    if (h) { blocks.push({ t: 'h', n: h[1].length, c: parseInline(h[2]) }); i += 1; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ t: 'hr' }); i += 1; continue; }
    if (line.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i += 1; }
      blocks.push({ t: 'table', head: head.map(parseInline), rows: rows.map((r) => r.map(parseInline)) });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      blocks.push({ t: 'quote', c: parseMarkdown(body.join('\n')) });
      continue;
    }
    if (listMark.test(line)) {
      const first = listMark.exec(line);
      const ordered = /\d/.test(first[2]);
      const items = [];
      while (i < lines.length && lines[i].trim() && listMark.test(lines[i])) {
        const mk = listMark.exec(lines[i]);
        const indent = mk[1].length;
        if (indent >= 2 && items.length) { items[items.length - 1].sub.push(mk[3]); i += 1; continue; } // one nested level
        items.push({ c: parseInline(mk[3]), sub: [] });
        i += 1;
      }
      blocks.push({ t: 'list', ordered, items: items.map((it) => ({ c: it.c, sub: it.sub.map(parseInline) })) });
      continue;
    }
    const para = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|```|>|([-*_])(\s*\2){2,}\s*$)/.test(lines[i]) && !listMark.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isSep(lines[i + 1]))) { para.push(lines[i].trim()); i += 1; }
    blocks.push({ t: 'p', c: parseInline(para.join(' ')) });
  }
  return blocks;
}
