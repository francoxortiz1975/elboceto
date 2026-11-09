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
