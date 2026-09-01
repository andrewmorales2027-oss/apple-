export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const invlerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a || 1));

export const smoothstep = (a: number, b: number, v: number) => {
  const t = invlerp(a, b, v);
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent lerp. `lambda` is roughly "how eager", 1..12. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * Math.min(dt, 0.1)));

/** Gaussian bump: 1 at p = 0.5, ~0 at the edges. The "moment" curve. */
export const bell = (p: number, sigma = 0.13) =>
  Math.exp(-((p - 0.5) * (p - 0.5)) / (2 * sigma * sigma));

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI / 2;
