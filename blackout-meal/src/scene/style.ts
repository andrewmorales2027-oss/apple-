/**
 * Visual direction presets.
 *
 * Procedural geometry chasing photorealism lands in the uncanny valley: close enough to a
 * photo that the eye starts grading it as one, and finds it wanting. The reliable way out
 * is to stop competing with photography and commit to a look the eye reads as deliberate.
 *
 * Each style here changes the shading model, the light rig, the grade AND the page
 * palette, so they are genuinely different directions rather than filters over one render.
 * Pick with ?style=<id>.
 */

export type StyleId = "studio" | "cel" | "clay" | "neon" | "riso";

/** How the food surfaces are shaded. */
export type Shading = "pbr" | "toon" | "matte" | "chrome";

export interface SceneStyle {
  id: StyleId;
  label: string;
  /** One line on what this direction is going for. */
  note: string;

  /** Page palette. `*Rgb` are comma-triples for rgba() in the stylesheet. */
  css: {
    ink: string;
    inkRgb: string;
    paper: string;
    paperRgb: string;
    accent: string;
    accentRgb: string;
    /** Drives the UA's form-control and scrollbar rendering. */
    scheme: "dark" | "light";
  };

  shading: Shading;
  /** Steps in the toon ramp, when shading is "toon". */
  toonSteps: number;
  /**
   * Minimum lightness, and a saturation multiplier, applied to every food colour in the
   * flat directions.
   *
   * The photoreal palette is deliberately dark — a charcoal bun and a near-black patty
   * that only read because rim light carves them off the background. Flat shading has no
   * rim light, so those same colours arrive as a black hole. Poster art solves this at
   * the palette, not the lamp: brighter, more saturated inks.
   */
  colorLift: number;
  satBoost: number;
  /** Scene clear colour and fog; usually the page background. */
  background: string;
  fog: [number, number];
  envIntensity: number;
  exposure: number;
  /**
   * ACES is a filmic S-curve: it compresses highlights and shifts saturated darks toward
   * their hue's bright end, which is exactly what you want from a photograph and exactly
   * wrong for flat art, where the whole contract is that the colour on screen is the
   * colour you authored.
   */
  toneMapping: "aces" | "linear";
  /** Multipliers on the base light rig. */
  keyMul: number;
  rimMul: number;
  /** Surface detail maps often fight a flat look. */
  normalScale: number;
  /** Extra saturated rims, for the neon direction. */
  neonRims: boolean;
  shadows: boolean;

  effects: {
    bloom: false | { threshold: number; intensity: number };
    /**
     * Posterisation. NOTE: this is TOTAL bits across RGB, not per channel —
     * postprocessing computes `factor = 2^(bits/3)`, so 6 means four levels per channel,
     * which collapses every warm tone onto the same muddy red. Its own default is 16.
     */
    colorDepth: false | number;
    /** Halftone dot screen. */
    dotScreen: false | { scale: number };
    grain: number;
    vignette: false | { offset: number; darkness: number };
    chromatic: false | number;
    saturation: number;
    contrast: number;
    /** Depth of field, high tier only, and only where the look wants it. */
    dof: boolean;
  };
}

export const STYLES: Record<StyleId, SceneStyle> = {
  studio: {
    id: "studio",
    label: "Studio Photoreal",
    note: "HDR studio lighting, wet speculars, shallow focus. The current build.",
    css: { ink: "#0a0605", inkRgb: "10, 6, 5", paper: "#f2ece2", paperRgb: "242, 236, 226", accent: "#c81e2c", accentRgb: "200, 30, 44", scheme: "dark" },
    shading: "pbr",
    toonSteps: 4,
    colorLift: 0,
    satBoost: 1,
    background: "#0a0605",
    fog: [10, 30],
    envIntensity: 1.9,
    exposure: 1.15,
    toneMapping: "aces",
    keyMul: 1,
    rimMul: 1,
    normalScale: 1,
    neonRims: false,
    shadows: true,
    effects: {
      bloom: { threshold: 0.72, intensity: 0.55 },
      colorDepth: false,
      dotScreen: false,
      grain: 0.02,
      vignette: { offset: 0.28, darkness: 0.62 },
      chromatic: 0.0007,
      saturation: 0,
      contrast: 0,
      dof: true,
    },
  },

  cel: {
    id: "cel",
    label: "Cel Shaded",
    note: "Hard banded light, saturated flats, poster-graphic. Reads as illustration, so the eye never grades it against a photo.",
    css: { ink: "#12101c", inkRgb: "18, 16, 28", paper: "#fff6e6", paperRgb: "255, 246, 230", accent: "#ff3b30", accentRgb: "255, 59, 48", scheme: "dark" },
    shading: "toon",
    toonSteps: 4,
    colorLift: 0.46,
    satBoost: 1.4,
    background: "#12101c",
    // Fog off. A depth gradient run through a posteriser turns into visible contour
    // bands across the whole frame — the flat directions need flat ground.
    fog: [80, 300],
    envIntensity: 1.1,
    exposure: 1.05,
    toneMapping: "linear",
    keyMul: 0.8,
    rimMul: 1,
    normalScale: 0.25,
    neonRims: false,
    shadows: true,
    effects: {
      bloom: false,
      colorDepth: 15,
      dotScreen: false,
      grain: 0.012,
      vignette: { offset: 0.4, darkness: 0.4 },
      chromatic: false,
      saturation: 0.1,
      contrast: 0.06,
      dof: false,
    },
  },

  clay: {
    id: "clay",
    label: "Soft Clay",
    note: "Matte stop-motion surfaces, soft bounce, no hard speculars. Warm and tactile rather than glossy.",
    css: { ink: "#241a15", inkRgb: "36, 26, 21", paper: "#f7efe3", paperRgb: "247, 239, 227", accent: "#e2603c", accentRgb: "226, 96, 60", scheme: "dark" },
    shading: "matte",
    toonSteps: 4,
    colorLift: 0,
    satBoost: 1,
    background: "#241a15",
    fog: [14, 40],
    envIntensity: 2.4,
    exposure: 1.2,
    toneMapping: "aces",
    keyMul: 0.75,
    rimMul: 0.85,
    normalScale: 0.45,
    neonRims: false,
    shadows: true,
    effects: {
      bloom: false,
      colorDepth: false,
      dotScreen: false,
      grain: 0.03,
      vignette: { offset: 0.34, darkness: 0.45 },
      chromatic: false,
      saturation: -0.08,
      contrast: -0.05,
      dof: true,
    },
  },

  neon: {
    id: "neon",
    label: "Neon Chrome",
    note: "Glossy surfaces under saturated magenta/cyan rims, heavy bloom. Nightclub-poster energy — still food, but lit like a music video.",
    css: { ink: "#05050c", inkRgb: "5, 5, 12", paper: "#eef2ff", paperRgb: "238, 242, 255", accent: "#ff2d6f", accentRgb: "255, 45, 111", scheme: "dark" },
    shading: "chrome",
    toonSteps: 4,
    colorLift: 0,
    satBoost: 1,
    background: "#05050c",
    fog: [9, 28],
    envIntensity: 2.6,
    exposure: 1.05,
    toneMapping: "aces",
    keyMul: 0.85,
    rimMul: 1.2,
    normalScale: 0.8,
    neonRims: true,
    shadows: true,
    effects: {
      bloom: { threshold: 0.6, intensity: 0.95 },
      colorDepth: false,
      dotScreen: false,
      grain: 0.025,
      vignette: { offset: 0.2, darkness: 0.8 },
      chromatic: 0.0015,
      saturation: 0.3,
      contrast: 0.16,
      dof: false,
    },
  },

  riso: {
    id: "riso",
    label: "Risograph Print",
    note: "Printed on paper: flat inks, halftone dots, heavy grain, off-register colour. The furthest from a render.",
    css: { ink: "#efe6d4", inkRgb: "239, 230, 212", paper: "#1a1410", paperRgb: "26, 20, 16", accent: "#d8342b", accentRgb: "216, 52, 43", scheme: "light" },
    shading: "toon",
    toonSteps: 3,
    colorLift: 0.58,
    satBoost: 1.45,
    background: "#efe6d4",
    fog: [80, 300],
    envIntensity: 1.4,
    exposure: 1.42,
    toneMapping: "linear",
    keyMul: 1,
    rimMul: 0.6,
    normalScale: 0.15,
    neonRims: false,
    shadows: false,
    effects: {
      bloom: false,
      colorDepth: 12,
      dotScreen: { scale: 1.1 },
      grain: 0.07,
      vignette: false,
      chromatic: 0.0009,
      saturation: 0.04,
      contrast: 0.1,
      dof: false,
    },
  },
};

export const STYLE_ORDER: StyleId[] = ["studio", "cel", "clay", "neon", "riso"];

let cached: SceneStyle | null = null;

export function getStyle(): SceneStyle {
  if (cached) return cached;
  let id: StyleId = "studio";
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("style");
    if (q && q in STYLES) id = q as StyleId;
  }
  cached = STYLES[id];
  return cached;
}

/** Pushes the style's palette into the stylesheet's custom properties. */
export function applyStylePalette(style: SceneStyle) {
  const root = document.documentElement.style;
  root.setProperty("--ink", style.css.ink);
  root.setProperty("--ink-rgb", style.css.inkRgb);
  root.setProperty("--paper", style.css.paper);
  root.setProperty("--paper-rgb", style.css.paperRgb);
  root.setProperty("--accent", style.css.accent);
  root.setProperty("--accent-rgb", style.css.accentRgb);
  root.setProperty("color-scheme", style.css.scheme);
}
