// Theme preference: System follows the OS (tokens.css media query); Light and Dark pin it by
// setting <html data-theme>. The choice persists in localStorage, which can be unavailable
// (private windows, blocked storage), so every access is guarded and System is the fallback.
import { useCallback, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'kindling.theme';

export function readThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

function saveThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

/** [preference, set]: setting applies data-theme at once and persists it. */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  const set = useCallback((p: ThemePref) => {
    applyThemePref(p);
    saveThemePref(p);
    setPref(p);
  }, []);
  return [pref, set];
}
