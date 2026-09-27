/**
 * The one setting worth keeping: how scary it may get, which a grown-up
 * chooses. Kept in this browser and nowhere else. There are no scores to
 * keep; every run starts from nothing, on purpose.
 */
import type { Scare } from './world';

const KEY = 'sukhi-run-scare';

export function scare (): Scare {
  try {
    const n = Number(localStorage.getItem(KEY));
    if (n === 1 || n === 2 || n === 3) return n;
  } catch { /* storage off */ }
  return 2;
}

export function setScare (s: Scare): void {
  try { localStorage.setItem(KEY, String(s)); } catch { /* keep it for this visit */ }
}
