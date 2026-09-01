import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { getStyle, type Shading } from "./style";

/**
 * Re-shades the whole scene to match the chosen style.
 *
 * Rather than parameterising every ingredient component, this walks the scene graph once
 * after mount and rewrites materials in place, preserving each surface's authored colour
 * and maps. Adding a direction is then a data change in style.ts, not an edit to a dozen
 * components.
 */

/** Stepped ramp for MeshToonMaterial — this is what produces the hard light bands. */
function toonRamp(steps: number) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    // Floored at 0.42 rather than running to zero: cel animation paints a *shadow
    // colour*, not an absence of light. A ramp that reaches black turns every surface
    // facing away from the key into a hole in the frame.
    const t = Math.pow((i + 1) / steps, 1.1);
    data[i] = Math.round((0.42 + t * 0.58) * 255);
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

type AnyStandard = THREE.MeshStandardMaterial & Partial<THREE.MeshPhysicalMaterial>;

function isShadeable(mat: THREE.Material): mat is AnyStandard {
  return "color" in mat && "roughness" in mat;
}

function convert(
  mat: THREE.Material,
  shading: Shading,
  ramp: THREE.DataTexture,
  normalScale: number,
  colorLift: number,
  satBoost: number,
): THREE.Material | null {
  if (!isShadeable(mat)) return null;
  const src = mat as AnyStandard;

  // The bottle glass is the one surface that must keep its own material in the pbr
  // directions; in the flat directions it becomes a tinted solid like everything else.
  const isGlass = src.name === "bottle-glass";

  if (shading === "toon") {
    // Re-inked for print: hue is kept (a patty stays brown, lettuce stays green) but the
    // value and saturation are pushed to where a poster palette lives. Without this the
    // charcoal bun and the dark patty are two black shapes on a black ground.
    const color = src.color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    const lifted = Math.max(hsl.l, colorLift);
    // Desaturate in proportion to how far the colour was lifted. Brown is just dark
    // orange, so raising its value while holding saturation produces red — a tan is a
    // lightened brown that gave up saturation on the way up. Without this term every
    // warm ingredient converges on the same red and the burger becomes one shape.
    const desat = 1 - (lifted - hsl.l) * 0.9;
    color.setHSL(hsl.h, THREE.MathUtils.clamp(hsl.s * satBoost * desat, 0, 1), lifted);

    const toon = new THREE.MeshToonMaterial({
      color,
      map: src.map ?? null,
      gradientMap: ramp,
      transparent: isGlass || src.transparent,
      opacity: isGlass ? 0.72 : src.opacity,
      side: src.side,
    });
    if (src.emissive && src.emissiveIntensity) {
      toon.emissive = src.emissive.clone();
      toon.emissiveIntensity = src.emissiveIntensity * 0.6;
    }
    toon.name = src.name;
    return toon;
  }

  if (shading === "matte") {
    src.roughness = 1;
    src.metalness = 0;
    if ("clearcoat" in src) src.clearcoat = 0;
    if ("sheen" in src) src.sheen = 0;
    if ("specularIntensity" in src) src.specularIntensity = 0.15;
    src.envMapIntensity = 0.55;
    if (src.normalScale) src.normalScale.setScalar(normalScale);
    src.needsUpdate = true;
    return null;
  }

  if (shading === "chrome") {
    if (!isGlass) {
      // Full metalness made every ingredient a mirror and the burger unreadable as food.
      // A dielectric gloss keeps the albedo — you still see "cheese", lit like chrome.
      src.metalness = Math.min(0.3, (src.metalness ?? 0) + 0.22);
      src.roughness = Math.max(0.14, (src.roughness ?? 0.5) * 0.45);
      src.envMapIntensity = 1.5;
      if ("clearcoat" in src) src.clearcoat = 1;
      if ("clearcoatRoughness" in src) src.clearcoatRoughness = 0.08;
      if (src.normalScale) src.normalScale.setScalar(normalScale);
      src.needsUpdate = true;
    }
    return null;
  }

  return null;
}

export function StyleOverride() {
  const { scene } = useThree();
  const style = getStyle();
  const ramp = useMemo(() => toonRamp(style.toonSteps), [style.toonSteps]);
  const passes = useRef(0);

  // The parts mount across several frames (suspense boundaries, instanced meshes built in
  // memos), so the sweep runs on the first few frames rather than once in an effect.
  useFrame(() => {
    if (style.shading === "pbr" || passes.current > 3) return;
    passes.current += 1;

    const retired: THREE.Material[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = list.map((m) => {
        if (m.userData.styled) return m;
        const replacement = convert(m, style.shading, ramp, style.normalScale, style.colorLift, style.satBoost);
        if (replacement) {
          replacement.userData.styled = true;
          retired.push(m);
          return replacement;
        }
        m.userData.styled = true;
        return m;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    retired.forEach((m) => m.dispose());
  });

  return null;
}
