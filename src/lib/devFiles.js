// Markdown files an area mentions in its reports (docs to read). The launcher, which runs on the Mac, reads them and keeps a copy in
// the plan (plan.devFiles[itemId]) so the web page can show, download and copy them. Pure helpers here.

// Relative paths ending in .md found in a text (no URLs, no parent folders, no node_modules).
export function mdPathsIn(text = '') {
  const found = [];
  const re = /(?:^|[\s("'`:,])((?:[\w.@-]+\/)*[\w.@-]+\.md)(?=$|[\s)"'`:,;.])/gi;
  let m;
  while ((m = re.exec(String(text)))) {
    const p = m[1];
    if (p.includes('..') || p.includes('node_modules') || /^https?:/i.test(p)) continue;
    if (!found.includes(p)) found.push(p);
  }
  return found.slice(0, 8);
}
// Deliverables an area names in a report: documents, PDFs and images (relative paths only, no URLs, no parent folders).
export const FILE_EXT = ['md', 'pdf', 'png', 'jpg', 'jpeg', 'csv', 'txt', 'json', 'html'];
export function docPathsIn(text = '') {
  const found = [];
  const re = new RegExp(`(?:^|[\\s("'\`:,])((?:[\\w.@-]+\\/)*[\\w.@-]+\\.(?:${FILE_EXT.join('|')}))(?=$|[\\s)"'\`:,;.])`, 'gi');
  let m;
  while ((m = re.exec(String(text)))) {
    const p = m[1];
    if (p.includes('..') || p.includes('node_modules') || /^https?:/i.test(p)) continue;
    if (!found.includes(p)) found.push(p);
  }
  return found.slice(0, 8);
}
export const extOf = (path) => (String(path).split('.').pop() || '').toLowerCase();
export const kindOf = (path) => { const e = extOf(path); return e === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg'].includes(e) ? 'image' : e === 'md' ? 'markdown' : 'text'; };
export const MIME = { md: 'text/markdown;charset=utf-8', txt: 'text/plain;charset=utf-8', csv: 'text/csv;charset=utf-8', json: 'application/json;charset=utf-8', html: 'text/html;charset=utf-8', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
export const filesOf = (plan, itemId) => (plan.devFiles && plan.devFiles[itemId]) || [];
export const fileName = (path) => String(path).split('/').pop();
