// Theme: 'system' follows the OS; 'light' / 'dark' are explicit choices kept on this device.
import { useEffect, useState } from 'react';

const KEY = 'el_boceto_theme_v1';
export const THEMES = ['system', 'light', 'dark'];

export const loadTheme = () => {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch { return 'system'; }
};

const resolve = (theme) =>
  theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;

export function useTheme() {
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    const apply = () => {
      const t = resolve(theme);
      document.documentElement.dataset.theme = t;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = t === 'dark' ? '#161513' : '#F7F4EE';
    };
    apply();
    try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return [theme, setTheme];
}

// Extra top margin for an installed app whose window toolbar sits on top of the page. 0 = none.
// Without a saved value, an installed app (standalone window) that reports no safe-area inset gets a default
// (about the height of a Mac window toolbar). Option + arrow up/down adjusts it from the keyboard, so it
// can be fixed even when the menu itself is hidden behind the toolbar.
const TOP_KEY = 'el_boceto_top_extra_v1';
const AUTO_TOP = 48;
const savedTop = () => { try { const v = localStorage.getItem(TOP_KEY); return v === null ? null : Math.max(0, parseInt(v, 10) || 0); } catch { return null; } };
const isInstalled = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || window.matchMedia('(display-mode: fullscreen)').matches || window.navigator.standalone === true; } catch { return false; }
};
// Safari's installed apps on a Mac (windowed): the page is drawn under the window toolbar, so the window is no
// taller than the page (outer height ~ inner height). A normal Safari tab has a tall toolbar + tab bar instead.
const looksOverlapped = () => {
  try {
    const ua = navigator.userAgent;
    const safari = /safari/i.test(ua) && !/chrome|chromium|crios|android|electron/i.test(ua);
    return safari && /mac/i.test(navigator.platform) && Math.abs(window.outerHeight - window.innerHeight) <= 30;
  } catch { return false; }
};
const reportedInset = () => {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return px;
};
const toast = (text) => {
  let el = document.getElementById('top-extra-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'top-extra-toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;padding:6px 12px;border-radius:6px;background:rgba(24,24,27,.9);color:#fff;font:500 12px system-ui,sans-serif;pointer-events:none;transition:opacity .2s';
    document.body.appendChild(el);
  }
  el.textContent = text; el.style.opacity = '1';
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 1400);
};
const clampTop = (v) => Math.min(120, Math.max(0, v));

export function useTopExtra() {
  const [px, setPx] = useState(() => { const s = savedTop(); return s === null ? 0 : s; });
  const [manual, setManual] = useState(() => savedTop() !== null);

  // No saved value: add the default when the page looks hidden under the window toolbar, unless the browser
  // already reports the inset. Re-checked on resize (entering / leaving full screen changes the toolbar).
  useEffect(() => {
    if (manual) return undefined;
    const check = () => setPx(reportedInset() === 0 && (isInstalled() || looksOverlapped()) ? AUTO_TOP : 0);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [manual]);

  useEffect(() => {
    document.documentElement.style.setProperty('--top-extra', `${px}px`);
    if (manual) { try { localStorage.setItem(TOP_KEY, String(px)); } catch { /* storage unavailable */ } }
  }, [px, manual]);

  const set = (v) => { setManual(true); setPx(clampTop(v)); };

  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      const next = clampTop(px + (e.key === 'ArrowDown' ? 4 : -4));
      setManual(true); setPx(next);
      toast(`Margen superior: ${next} px`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [px]);

  return [px, set];
}
