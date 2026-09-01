/**
 * Device tiering. The 3D scene is built to hold 60fps on a mid-tier laptop; anything
 * that would push a low-end phone under that gets cut here rather than at render time.
 *
 * Cut order, cheapest win first: steam particles -> depth of field -> transmission
 * bottle -> bloom. DepthOfField runs on the high tier only (see the note below).
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
  /** Width of the generated HDR equirect map, before PMREM prefiltering. */
  envResolution: number;
  /** Edge length of the generated normal/roughness maps. */
  textureSize: number;
  /** Depth of field. High tier only — see the note below. */
  dof: boolean;
  /**
   * Clearcoat and sheen lobes across the food materials. These are what read as wet fat,
   * waxy leaf and brined pickle rather than flat paint, but each one compiles an extra
   * BRDF lobe into the shader, so the low tier goes without.
   */
  richMaterials: boolean;
}

function detectTier(): Tier {
  if (typeof navigator === "undefined") return "mid";

  // Manual override for QA: ?tier=low|mid|high. Device detection is a heuristic and the
  // top tier in particular is hard to reach on a CI or headless machine, so there has to
  // be a way to look at each tier deliberately.
  const forced = new URLSearchParams(window.location.search).get("tier");
  if (forced === "low" || forced === "mid" || forced === "high") return forced;

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
 * DepthOfField ships on the high tier only.
 *
 * It costs ~4-6ms/frame at 1080p on integrated graphics, which is the whole difference
 * between 60fps and 45fps on mid-tier hardware — so mid and low do without, and the
 * scene still reads filmic from the HDR key and the tight bloom. On a discrete GPU
 * there is headroom for it, and a shallow focal plane is one of the strongest
 * photographic cues available, so the top tier gets it.
 *
 * This is still the first thing to cut if the budget tightens again.
 */

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
    envResolution: 128,
    textureSize: 256,
    dof: false,
    richMaterials: false,
  },
  mid: {
    dpr: [1, 1.75],
    steamCount: 16,
    sesameCount: 120,
    dropletCount: 90,
    transmission: true,
    transmissionResolution: 256,
    postprocessing: true,
    geometryDetail: 1,
    shadows: true,
    envResolution: 256,
    textureSize: 512,
    dof: false,
    richMaterials: true,
  },
  high: {
    dpr: [1, 2],
    steamCount: 24,
    sesameCount: 170,
    dropletCount: 140,
    transmission: true,
    transmissionResolution: 512,
    postprocessing: true,
    geometryDetail: 1.5,
    shadows: true,
    envResolution: 512,
    textureSize: 1024,
    dof: true,
    richMaterials: true,
  },
};

let cached: Quality | null = null;

export function getQuality(): Quality {
  if (cached) return cached;
  const tier = detectTier();
  cached = { tier, ...PRESETS[tier] };
  return cached;
}
