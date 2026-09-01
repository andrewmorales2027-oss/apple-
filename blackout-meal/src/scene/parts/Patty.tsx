import { useMemo } from "react";
import * as THREE from "three";
import { pattyNormal, pattyRoughness } from "../textures";
import { seeded } from "../easing";
import { getQuality } from "../../lib/quality";

/**
 * A smash patty is not a disc. The edges tear outward where it hit the griddle and the
 * face craters where the crust set, so the geometry itself is displaced before the char
 * normal map goes on top — a flat cylinder reads as plastic no matter how good the map is.
 */
function buildPattyGeometry(radius: number, height: number, seed: number, detail: number) {
  const radial = Math.round(96 * detail);
  const geo = new THREE.CylinderGeometry(radius, radius * 0.94, height, radial, 6, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const rand = seeded(seed);

  // A handful of low-frequency lobes give the outline its hand-smashed asymmetry.
  const lobes = Array.from({ length: 7 }, () => ({
    phase: rand() * Math.PI * 2,
    freq: 2 + Math.floor(rand() * 5),
    amp: 0.02 + rand() * 0.05,
  }));

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);

    const angle = Math.atan2(v.z, v.x);
    const r = Math.hypot(v.x, v.z);
    let outline = 0;
    for (const l of lobes) outline += Math.sin(angle * l.freq + l.phase) * l.amp;

    if (Math.abs(n.y) > 0.7) {
      // Cap: crater the face, and let the outline bulge carry through to the rim.
      const crater =
        Math.sin(v.x * 6.1 + seed) * Math.cos(v.z * 5.3 - seed) * 0.016 +
        Math.sin(v.x * 13.7) * Math.sin(v.z * 11.9) * 0.008;
      const rim = r / radius;
      v.y += (crater + (rand() - 0.5) * 0.004) * (1 - rim * 0.55) * Math.sign(n.y || 1);
      if (rim > 0.9) {
        v.x *= 1 + outline;
        v.z *= 1 + outline;
      }
    } else {
      // Side wall: ragged, torn edge.
      const ripple = Math.sin(angle * 11 + v.y * 5) * 0.008;
      const k = 1 + outline + ripple;
      v.x *= k;
      v.z *= k;
      v.y += Math.sin(angle * 7 + seed) * 0.009;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function Single({ y, seed, radius }: { y: number; seed: number; radius: number }) {
  const { geometryDetail } = getQuality();
  const geo = useMemo(
    () => buildPattyGeometry(radius, 0.3, seed, geometryDetail),
    [radius, seed, geometryDetail],
  );

  return (
    <mesh position={[0, y, 0]} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        color="#3a2318"
        roughness={0.78}
        metalness={0.04}
        normalMap={pattyNormal()}
        normalScale={new THREE.Vector2(0.95, 0.95)}
        roughnessMap={pattyRoughness()}
      />
    </mesh>
  );
}

/** Two patties, smashed, rotated off each other so both outlines read from the side. */
export function Patties() {
  return (
    <group>
      <group rotation={[0, 0.4, 0.015]}>
        <Single y={-0.42} seed={17} radius={1.0} />
      </group>
      <group rotation={[0, -0.9, -0.02]}>
        <Single y={-0.1} seed={41} radius={1.02} />
      </group>
    </group>
  );
}
