// Installs (or removes) the IRIS+ launcher as a macOS LaunchAgent: it runs every minute while you are logged in.
// Usage: npm run iris:launcher:install        |        npm run iris:launcher:uninstall
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const label = 'com.boceto.iris-launcher';
const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
const uninstall = process.argv.includes('--uninstall');
const launchctl = (...a) => { try { execFileSync('launchctl', a, { stdio: 'pipe' }); return true; } catch { return false; } };

if (process.platform !== 'darwin') { console.error('El lanzador automático es solo para macOS. En otro sistema usa: npm run iris:launcher (queda corriendo en una terminal).'); process.exit(1); }

if (uninstall) {
  launchctl('unload', plistPath);
  if (fs.existsSync(plistPath)) fs.unlinkSync(plistPath);
  console.log('Lanzador IRIS+ quitado.');
  process.exit(0);
}

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'iris-launcher.mjs');
if (!fs.existsSync(script)) { console.error(`Falta ${script}. Corre primero: npm run mcp:build`); process.exit(1); }
const claudeOk = (() => { try { execFileSync('/bin/zsh', ['-lc', 'command -v claude'], { stdio: 'pipe' }); return true; } catch { return false; } })();
let terminalMode = false;
try { terminalMode = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'boceto-mcp', 'iris-areas.json'), 'utf8')).mode === 'terminal'; } catch { /* default: the Claude app */ }
const logFile = path.join(os.homedir(), 'Library', 'Logs', 'iris-launcher.log');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${esc(process.execPath)}</string><string>${esc(script)}</string><string>--once</string></array>
  <key>StartInterval</key><integer>60</integer>
  <key>AbandonProcessGroup</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${esc(logFile)}</string>
  <key>StandardErrorPath</key><string>${esc(logFile)}</string>
</dict></plist>
`;
fs.mkdirSync(path.dirname(plistPath), { recursive: true });
fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(plistPath, plist);
launchctl('unload', plistPath);
const loaded = launchctl('load', '-w', plistPath);
console.log(`${loaded ? 'Lanzador IRIS+ instalado y en marcha' : 'Lanzador IRIS+ escrito, pero launchctl no lo cargó (cierra sesión y vuelve a entrar, o corre: launchctl load -w ' + plistPath + ')'}.`);
console.log(`  cada minuto mira El Boceto; registro: ${logFile}`);
console.log('\nPor defecto abre la app de Claude (pestaña Code) en la carpeta del área, con el encargo escrito: confirma la carpeta y pulsa Enter para enviarlo.');
if (terminalMode && !claudeOk) console.log('\nOJO: tienes "mode": "terminal" pero no encuentro el comando `claude` en esta terminal (el lanzador lo busca también por su ruta completa). Si no lo tienes: curl -fsSL https://claude.ai/install.sh | bash');
if (terminalMode) console.log('Con "mode": "terminal", macOS preguntará la primera vez si permite controlar Terminal: acepta.');
console.log('Para quitarlo: npm run iris:launcher:uninstall');
