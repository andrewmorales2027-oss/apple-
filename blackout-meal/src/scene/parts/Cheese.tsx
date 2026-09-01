import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clamp01, easeOutWobble, seeded } from "../easing";

const CHEESE_Y = 0.09;
const SLAB_R = 1.06;

/** Slab with a drooping rim — melted cheese sags over the patty edge before it drips. */
function useSlabGeometry() {
  return useMemo(() => {
    const geo = new THREE.CylinderGeometry(SLAB_R, SLAB_R, 0.05, 72, 3, false);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = Math.hypot(v.x, v.z) / SLAB_R;
      const angle = Math.atan2(v.z, v.x);
      // Rim sag, plus a slow wobble around the circumference so it isn't a perfect disc.
      const droop = Math.pow(Math.max(0, r - 0.5) / 0.5, 1.9);
      v.y -= droop * (0.2 + Math.sin(angle * 3.1) * 0.07 + Math.sin(angle * 7.3) * 0.03);
      const bulge = 1 + Math.sin(angle * 5 + 1.2) * 0.03;
      v.x *= bulge;
      v.z *= bulge;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);
}

interface Drip {
  angle: number;
  radius: number;
  length: number;
  width: number;
  stagger: number;
  sway: number;
}

function useDrips(): Drip[] {
  return useMemo(() => {
    const rand = seeded(5150);
    const count = 9;
    return Array.from({ length: count }, (_, i) => ({
      // Clustered rather than evenly spaced: melt runs where the slab happens to sag.
      angle: (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.75,
      radius: 0.94 + rand() * 0.09,
      // Short and thin. Long fat drips read as balustrade posts, not as cheese.
      length: 0.09 + Math.pow(rand(), 1.7) * 0.17,
      width: 0.016 + rand() * 0.018,
      // Staggered so the drips land in a ripple around the burger, not all at once.
      stagger: rand() * 0.42,
      sway: (rand() - 0.5) * 0.5,
    }));
  }, []);
}

/**
 * The payoff beat of the assembly sequence: each drip extends past the patty edge with a
 * damped-spring overshoot, so the melt visibly wobbles as it settles rather than snapping
 * to length. `progress` is this layer's own 0..1 window, written by the Burger rig.
 */
export function Cheese({ progress }: { progress: RefObject<number> }) {
  const slab = useSlabGeometry();
  const drips = useDrips();
  const refs = useRef<(THREE.Group | null)[]>([]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c8811d",
        roughness: 0.42,
        metalness: 0.02,
        emissive: new THREE.Color("#6b3406"),
        emissiveIntensity: 0.22,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const p = progress.current ?? 1;
    const t = clock.elapsedTime;

    for (let i = 0; i < drips.length; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const d = drips[i];
      const local = clamp01((p - d.stagger) / (1 - d.stagger));
      const e = easeOutWobble(local, 2.1 + d.sway, 5.2);

      g.scale.y = Math.max(0.0001, e);
      // The wobble reads twice as clearly with a little lateral swing on the way down.
      g.rotation.z = Math.sin(local * Math.PI * 3.4 + d.sway * 3) * 0.16 * (1 - clamp01(local));
      // Once settled, a barely-there live sway keeps the melt from looking frozen.
      if (local >= 1) g.rotation.z = Math.sin(t * 1.4 + i) * 0.012;
    }
  });

  return (
    <group position={[0, CHEESE_Y, 0]}>
      <mesh geometry={slab} material={material} castShadow />
      {drips.map((d, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[Math.cos(d.angle) * d.radius, -0.11, Math.sin(d.angle) * d.radius]}
          // Leans outward with the sag of the rim it is running off.
          rotation={[Math.sin(d.angle) * 0.16, 0, -Math.cos(d.angle) * 0.16]}
        >
          {/* Hangs from the group origin so scaling Y grows it downward, and tapers
              wide-to-narrow: an untapered capsule reads as a post, not as melt. */}
          <mesh position={[0, -d.length / 2, 0]} material={material} castShadow>
            <cylinderGeometry args={[d.width, d.width * 0.42, d.length, 10, 1]} />
          </mesh>
          {/* Bead of cheese gathering at the tip. */}
          <mesh position={[0, -d.length - d.width * 0.4, 0]} scale={[1.15, 0.8, 1.15]} material={material}>
            <sphereGeometry args={[d.width * 0.7, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
