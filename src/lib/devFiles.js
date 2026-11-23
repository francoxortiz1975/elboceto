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
export const filesOf = (plan, itemId) => (plan.devFiles && plan.devFiles[itemId]) || [];
export const fileName = (path) => String(path).split('/').pop();
