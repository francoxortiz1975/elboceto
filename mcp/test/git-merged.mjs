import { branchFromReport } from '../src/gitMerged.mjs';
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) bad++; };
ok(branchFromReport('RAMA: iris/MC001-saludo · COMMIT: 93f8c16') === 'iris/MC001-saludo', 'branch from the RAMA line');
ok(branchFromReport('LISTO. Rama local iris/demo-nova-salud-continua, commit 93f8c16 sobre main') === 'iris/demo-nova-salud-continua', 'branch from a free-form report (trailing comma removed)');
ok(branchFromReport('Rama `iris/x-y`.') === 'iris/x-y' && branchFromReport('sin rama') === '', 'backticks and no branch');
process.exit(bad ? 1 : 0);
