export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Lands slightly past the target and settles back — the weight of a dropped ingredient. */
export const easeOutBack = (t: number, overshoot = 1.34) => {
  const x = clamp01(t);
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + overshoot * Math.pow(x - 1, 2);
};

/**
 * Damped spring settle: overshoots, wobbles twice, dies. Used for the cheese drip so the
 * melt visibly jiggles as it lands instead of snapping to its final length.
 */
export const easeOutWobble = (t: number, freq = 2.2, decay = 5.5) => {
  const x = clamp01(t);
  if (x >= 1) return 1;
  return 1 - Math.exp(-decay * x) * Math.cos(freq * Math.PI * x);
};

/** Deterministic pseudo-random so a reload always produces the same "hand-made" burger. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
