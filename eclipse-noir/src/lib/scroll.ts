/**
 * A single mutable scroll store, written by ScrollTrigger and read inside
 * `useFrame`. Deliberately *not* React state: the camera reads it 60x/second
 * and must never trigger a re-render.
 *
 * Every section registers with `start: 'top center' / end: 'bottom center'`,
 * which makes the five phases tile the page exactly — at any scroll position
 * precisely one phase is mid-flight and every earlier one is pinned at 1.
 */
export const PHASE_ORDER = ['hero', 'totality', 'corona', 'notes', 'product'] as const;
export type PhaseKey = (typeof PHASE_ORDER)[number];

export type ScrollState = Record<PhaseKey, number> & {
  active: PhaseKey;
  activeP: number;
};

export const scrollState: ScrollState = {
  hero: 0,
  totality: 0,
  corona: 0,
  notes: 0,
  product: 0,
  active: 'hero',
  activeP: 0,
};

export function setPhaseProgress(key: PhaseKey, p: number) {
  scrollState[key] = p;

  // The last phase that has begun is the one currently driving the camera.
  let active: PhaseKey = 'hero';
  let activeP = scrollState.hero;
  for (const k of PHASE_ORDER) {
    if (scrollState[k] > 0) {
      active = k;
      activeP = scrollState[k];
    }
  }
  scrollState.active = active;
  scrollState.activeP = activeP;
}
