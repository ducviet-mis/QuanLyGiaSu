import { useLayoutEffect, useRef, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

/** Keep display feedback independent of the serialized workspace save queue. */
export function useThemeToggle(saved: Theme, owner: string, persist: (theme: Theme) => Promise<boolean>) {
  const [selection, setSelection] = useState<{ owner: string; theme: Theme } | null>(null);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const request = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeOwner = useRef(owner);
  const theme = selection?.owner === owner ? selection.theme : saved;
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  useLayoutEffect(() => {
    activeOwner.current = owner;
    request.current++;
    setSelection(null);
    return () => { request.current++; clearTimeout(saveTimer.current); };
  }, [owner]);

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  function toggleTheme() {
    // Capture the choice at click time, not when a queued save eventually runs.
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const run = ++request.current;
    document.documentElement.dataset.theme = next;
    setSelection({ owner, theme: next });
    // Only the latest request may release the optimistic selection. Older
    // responses must not flash an intermediate theme or affect another user.
    clearTimeout(saveTimer.current);
    // Let the browser paint first and combine clicks made in quick succession.
    saveTimer.current = setTimeout(() => {
      void persist(next).catch(() => false).finally(() => {
        if (request.current === run && activeOwner.current === owner) setSelection(null);
      });
    }, 180);
  }

  return { isDark, toggleTheme };
}
