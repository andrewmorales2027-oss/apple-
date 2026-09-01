import * as THREE from "three";

/**
 * A studio lighting environment, painted as a real HDR equirectangular map.
 *
 * This is the difference between "3D render" and "photograph". The previous rig lit the
 * scene with lamps and an LDR environment, where nothing can be brighter than 1.0 — so
 * every highlight topped out at plain white and read as plastic. A real studio has
 * softboxes running several stops over mid-grey, and it is that overexposed core, rolling
 * off through a soft edge, that the eye reads as a photographed specular.
 *
 * Values here go up to ~14. Painted into a Float32 texture, run through PMREMGenerator so
 * roughness blurs it correctly, and generated at load time — nothing is downloaded.
 */

interface Emitter {
  /** Centre in equirect UV space: u is azimuth 0..1, v is 0 at the zenith. */
  u: number;
  v: number;
  /** Half-extent in UV. */
  du: number;
  dv: number;
  /** Radiance at the core, in units where 1.0 is mid-grey. */
  intensity: number;
  color: [number, number, number];
  /** 0 = hard edge, 1 = fully feathered. Soft edges are what sell the rolloff. */
  feather: number;
}

/**
 * A key softbox high and front-right, a tall narrow strip to camera-left, and a warm
 * kicker behind. The strip is doing the most work: a long vertical source is what draws
 * the continuous specular streak down the side of the bottle and across the bun crown,
 * and it is the single most photographic cue in the whole frame.
 */
const EMITTERS: Emitter[] = [
  // Key softbox — large, high, warm-neutral.
  { u: 0.32, v: 0.13, du: 0.13, dv: 0.1, intensity: 9, color: [1.0, 0.96, 0.9], feather: 0.75 },
  // Strip light, camera-left. Narrow and tall on purpose.
  { u: 0.63, v: 0.36, du: 0.022, dv: 0.24, intensity: 14, color: [0.78, 0.86, 1.0], feather: 0.55 },
  // Warm kicker behind-right, the one place the brand red touches the lighting.
  { u: 0.08, v: 0.4, du: 0.05, dv: 0.16, intensity: 5.5, color: [1.0, 0.42, 0.32], feather: 0.8 },
  // Small hard accent for tight sparkle in the condensation and sesame.
  { u: 0.45, v: 0.22, du: 0.018, dv: 0.018, intensity: 12, color: [1.0, 0.99, 0.97], feather: 0.35 },
  // Very low fill from front-below, so undersides don't crush to pure black.
  { u: 0.85, v: 0.6, du: 0.2, dv: 0.12, intensity: 0.5, color: [0.9, 0.75, 0.6], feather: 1 },
];

function smoothstep(t: number) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function buildEquirect(width: number): THREE.DataTexture {
  const height = width / 2;
  const data = new Float32Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;

      // Ambient: a dim warm dome falling to near-black at the horizon, with a hint of
      // bounce off the table below it. Never truly zero — pure black kills the shadows —
      // but kept very low: this is a blackout campaign, and an ambient dome bright enough
      // to be comfortable is exactly what lifts the blacks into grey.
      const above = 1 - smoothstep((v - 0.1) / 0.45);
      let r = 0.005 + above * 0.016;
      let g = 0.004 + above * 0.014;
      let b = 0.004 + above * 0.016;
      if (v > 0.52) {
        const floor = smoothstep((v - 0.52) / 0.4);
        r += floor * 0.011;
        g += floor * 0.008;
        b += floor * 0.005;
      }

      for (const e of EMITTERS) {
        // Azimuth wraps, so measure the shorter way around.
        let dU = Math.abs(u - e.u);
        if (dU > 0.5) dU = 1 - dU;
        const nx = dU / e.du;
        const ny = Math.abs(v - e.v) / e.dv;
        const d = Math.hypot(nx, ny);
        if (d >= 1) continue;
        // Flat core, feathered shoulder — a softbox, not a point.
        const core = 1 - e.feather;
        const falloff = d <= core ? 1 : 1 - smoothstep((d - core) / (1 - core));
        const a = falloff * falloff * e.intensity;
        r += e.color[0] * a;
        g += e.color[1] * a;
        b += e.color[2] * a;
      }

      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  // Float data is already linear; tagging it sRGB would double-apply the transfer curve.
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Prefilters the map so a rough surface samples a blurred version and a polished one
 * samples the sharp original. Without this pass every material reflects the same
 * mip level and the whole scene reads uniformly shiny.
 */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer, width: number) {
  const source = buildEquirect(width);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(source);
  source.dispose();
  pmrem.dispose();
  return target.texture;
}
