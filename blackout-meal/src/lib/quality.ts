/**
 * Device tiering. The 3D scene is built to hold 60fps on a mid-tier laptop; anything
 * that would push a low-end phone under that gets cut here rather than at render time.
 *
 * Cut order, cheapest win first: steam particles -> depth of field -> transmission
 * bottle -> bloom. DepthOfField is off on every tier by default (see DOF_ENABLED).
 */

export type Tier = "low" | "mid" | "high";

export interface Quality {
  tier: Tier;
  /** Device pixel ratio ceiling handed to <Canvas dpr>. */
  dpr: [number, number];
  /** Steam particle instances during the assembly beat. 0 disables the system. */
  steamCount: number;
  /** Sesame seeds instanced across the top bun crown. */
  sesameCount: number;
  /** Condensation droplets instanced over the bottle. */
  dropletCount: number;
  /** drei MeshTransmissionMaterial — real refraction, but it renders the scene again. */
  transmission: boolean;
  /** Off-screen buffer resolution for the transmission pass. */
  transmissionResolution: number;
  /** Bloom + film grain. */
  postprocessing: boolean;
  /** Cheese/bacon get displaced geometry instead of flat primitives at this density. */
  geometryDetail: number;
  /** Contact shadows under the meal. */
  shadows: boolean;
}

function detectTier(): Tier {
  if (typeof navigator === "undefined") return "mid";

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 700;

  // Phones and tablets: assume a shared-memory GPU and a thermal budget.
  if (coarse && smallViewport) return cores >= 8 && memory >= 6 ? "mid" : "low";
  if (cores <= 4 || memory <= 4) return "low";
  if (cores >= 8 && memory >= 8) return "high";
  return "mid";
}

/**
 * DepthOfField is deliberately not shipped on. It costs ~4-6ms/frame at 1080p on
 * integrated graphics, which is the difference between 60fps and 45fps on the exact
 * mid-tier hardware this page is aimed at, and the scene already reads as filmic from
 * the hard key light plus tight bloom. Flip this to true only after profiling.
 */
export const DOF_ENABLED = false;

const PRESETS: Record<Tier, Omit<Quality, "tier">> = {
  low: {
    dpr: [1, 1.25],
    steamCount: 0,
    sesameCount: 60,
    dropletCount: 40,
    transmission: false,
    transmissionResolution: 128,
    postprocessing: false,
    geometryDetail: 0.5,
    shadows: false,
  },
  mid: {
    dpr: [1, 1.75],
    steamCount: 26,
    sesameCount: 120,
    dropletCount: 90,
    transmission: true,
    transmissionResolution: 256,
    postprocessing: true,
    geometryDetail: 1,
    shadows: true,
  },
  high: {
    dpr: [1, 2],
    steamCount: 44,
    sesameCount: 170,
    dropletCount: 140,
    transmission: true,
    transmissionResolution: 512,
    postprocessing: true,
    geometryDetail: 1.5,
    shadows: true,
  },
};

let cached: Quality | null = null;

export function getQuality(): Quality {
  if (cached) return cached;
  const tier = detectTier();
  cached = { tier, ...PRESETS[tier] };
  return cached;
}
