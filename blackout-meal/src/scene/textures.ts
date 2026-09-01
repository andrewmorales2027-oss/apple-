import * as THREE from "three";
import { getQuality } from "../lib/quality";

/**
 * Everything the scene needs in the way of surface detail is generated here, in a 2D
 * canvas, at load time. No external asset downloads — `npm run dev` shows the finished
 * experience on a cold checkout.
 */

function hash(x: number, y: number, seed: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

function fbm(x: number, y: number, octaves: number, seed: number) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * freq, y * freq, seed + i * 13) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / norm;
}

type HeightFn = (u: number, v: number) => number;

function heightField(size: number, fn: HeightFn) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h[y * size + x] = fn(x / size, y / size);
    }
  }
  return h;
}

/** Sobel the height field into a tangent-space normal map. */
function normalFromHeight(h: Float32Array, size: number, strength: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // normalize(-dx, -dy, 1)
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function grayscale(h: Float32Array, size: number, lo = 0, hi = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < h.length; i++) {
    const v = (lo + (hi - lo) * h[i]) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Map resolution follows the device tier: 256 on low, 512 on mid, 1024 on high. */
function mapSize() {
  return getQuality().textureSize;
}

function tex(canvas: HTMLCanvasElement, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  // Surfaces are seen at grazing angles constantly as the camera orbits; without
  // anisotropy the patty crust smears into mush along the silhouette.
  t.anisotropy = 8;
  return t;
}

function memo<T>(fn: () => T): () => T {
  let value: T | undefined;
  return () => (value === undefined ? (value = fn()) : value);
}

/** Charred, cratered smash-patty crust — coarse blotches over a fine grain. */
export const pattyNormal = memo(() => {
  const size = mapSize();
  const octaves = size >= 512 ? 5 : 4;
  const h = heightField(size, (u, v) => {
    const coarse = fbm(u * 7, v * 7, octaves, 1.2);
    const craters = Math.pow(fbm(u * 14, v * 14, 3, 9.4), 2.2);
    const grain = fbm(u * 48, v * 48, 3, 3.1) * 0.25;
    // Fine blistered crust, only resolvable once the map is 512 or better.
    const blister = size >= 512 ? Math.pow(fbm(u * 110, v * 110, 2, 12.6), 3) * 0.18 : 0;
    return coarse * 0.5 + craters * 0.28 + grain + blister;
  });
  return tex(normalFromHeight(h, size, 9), 1);
});

/** Roughness break-up for the patty: the char is matte, the rendered fat is not. */
export const pattyRoughness = memo(() => {
  const size = mapSize();
  const h = heightField(size, (u, v) => {
    const blotch = fbm(u * 9, v * 9, 3, 5.7);
    return 0.45 + blotch * 0.55;
  });
  return tex(grayscale(h, size), 1);
});

/** Brioche crumb — tight, shallow, evenly distributed. */
export const bunNormal = memo(() => {
  const size = mapSize();
  const h = heightField(size, (u, v) => {
    const crumb = fbm(u * 26, v * 26, 3, 21.3) * 0.62;
    const fine = fbm(u * 70, v * 70, 2, 4.4) * 0.26;
    // Individual crumb pores; below 512 they alias into noise, so they're gated.
    const pores = size >= 512 ? Math.pow(fbm(u * 150, v * 150, 2, 31.7), 2.5) * 0.2 : 0.12;
    return crumb + fine + pores;
  });
  return tex(normalFromHeight(h, size, 4.5), 2);
});

/** Lettuce ripple — long directional waves crossed with a fine leaf grain. */
export const lettuceNormal = memo(() => {
  const size = mapSize();
  const h = heightField(size, (u, v) => {
    const ribs = Math.sin(u * Math.PI * 9 + fbm(u * 3, v * 3, 2, 8) * 5) * 0.5 + 0.5;
    const grain = fbm(u * 40, v * 40, 2, 17) * 0.35;
    return ribs * 0.65 + grain;
  });
  return tex(normalFromHeight(h, size, 7), 1);
});

/** Streaky bacon grain running along the strip. */
export const baconNormal = memo(() => {
  const size = mapSize();
  const h = heightField(size, (u, v) => {
    const streak = fbm(u * 3, v * 22, 3, 33);
    return streak * 0.8 + fbm(u * 30, v * 30, 2, 6) * 0.2;
  });
  return tex(normalFromHeight(h, size, 6), 1);
});

/** Soft radial alpha sprite: steam puffs, and the light bloom under the meal. */
export const softSprite = memo(() => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.35, "rgba(255,255,255,0.28)");
  g.addColorStop(0.7, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/** The Brazen Cola wrap: black ground, one hot red band, wordmark knocked out of it. */
export const colaLabel = memo(() => {
  const w = 1024;
  const h = 512;
  const repeats = 3;
  const cell = w / repeats;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0a0605";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#c81e2c";
  ctx.fillRect(0, h * 0.16, w, h * 0.68);

  ctx.fillStyle = "#f2ece2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  /**
   * The display webfont may not have arrived by the time this canvas is drawn, and the
   * fallback is far wider — so every line is measured and shrunk to fit its cell rather
   * than trusting a hardcoded size. Without this the wordmark runs into its neighbour.
   */
  const fit = (text: string, weight: number, max: number, maxWidth: number) => {
    let size = max;
    for (let i = 0; i < 24; i++) {
      ctx.font = `${weight} ${size}px "Barlow Condensed", system-ui, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size *= 0.92;
    }
    return size;
  };

  for (let i = 0; i < repeats; i++) {
    const cx = cell * i + cell / 2;
    const inner = cell * 0.78;
    fit("BRAZEN", 800, 128, inner);
    ctx.fillText("BRAZEN", cx, h * 0.44);
    fit("C O L A", 600, 46, inner * 0.8);
    ctx.fillText("C O L A", cx, h * 0.66);
  }

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
});

export function disposeTextures() {
  [pattyNormal, pattyRoughness, bunNormal, lettuceNormal, baconNormal, softSprite, colaLabel].forEach((f) => f().dispose());
}
