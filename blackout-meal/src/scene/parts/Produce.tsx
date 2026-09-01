import { useMemo } from "react";
import * as THREE from "three";
import { lettuceNormal } from "../textures";
import { seeded } from "../easing";
import { getQuality } from "../../lib/quality";

/** Frilled, rippling leaf: a disc with a wavy edge and a subnormal-mapped surface. */
function leafGeometry(radius: number, seed: number) {
  const geo = new THREE.CircleGeometry(radius, 72);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const rand = seeded(seed);
  const f1 = 4 + Math.floor(rand() * 4);
  const f2 = 9 + Math.floor(rand() * 5);
  const phase = rand() * Math.PI * 2;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.y) / radius;
    const angle = Math.atan2(v.y, v.x);
    // Frilly outline.
    const frill = 1 + (Math.sin(angle * f2 + phase) * 0.06 + Math.sin(angle * f1) * 0.05) * r;
    v.x *= frill;
    v.y *= frill;
    // Ripple out of plane, strongest at the edge.
    v.z += (Math.sin(angle * f1 + phase) * 0.09 + Math.sin(angle * f2 * 0.5) * 0.05) * Math.pow(r, 1.6);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function Lettuce() {
  const { richMaterials } = getQuality();
  const leaves = useMemo(() => {
    const rand = seeded(4242);
    return Array.from({ length: 5 }, (_, i) => ({
      geo: leafGeometry(0.98 + rand() * 0.14, 100 + i * 7),
      rot: [-Math.PI / 2 + (rand() - 0.5) * 0.32, 0, rand() * Math.PI * 2] as [number, number, number],
      pos: [(rand() - 0.5) * 0.26, (rand() - 0.5) * 0.05, (rand() - 0.5) * 0.26] as [number, number, number],
      shade: 0.82 + rand() * 0.3,
    }));
  }, []);

  const normal = lettuceNormal();

  return (
    <group position={[0, -0.63, 0]}>
      {leaves.map((l, i) => (
        <mesh key={i} geometry={l.geo} rotation={l.rot} position={l.pos} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={new THREE.Color("#39561a").multiplyScalar(l.shade)}
            roughness={0.72}
            metalness={0}
            // A leaf's waxy cuticle scatters light at grazing angles — sheen is the
            // cheapest honest stand-in for it, and it kills the "painted card" look.
            sheen={richMaterials ? 0.7 : 0}
            sheenRoughness={0.5}
            sheenColor="#b8d98a"
            clearcoat={richMaterials ? 0.25 : 0}
            clearcoatRoughness={0.55}
            side={THREE.DoubleSide}
            normalMap={normal}
            normalScale={new THREE.Vector2(0.9, 0.9)}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Tomato() {
  const { richMaterials } = getQuality();
  return (
    <group position={[0, 0.31, 0]} rotation={[0, 0.6, 0.01]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.98, 0.96, 0.09, 48]} />
        <meshPhysicalMaterial
          color="#7d0f16"
          roughness={0.44}
          metalness={0}
          clearcoat={richMaterials ? 0.35 : 0}
          clearcoatRoughness={0.4}
        />
      </mesh>
      {/* Cut face: seed pockets are lighter and wetter than the skin. */}
      <mesh position={[0, 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.94, 48]} />
        {/* The cut face is wet and slightly translucent — the glossiest thing in the stack
            after the cheese. */}
        <meshPhysicalMaterial
          color="#9e242c"
          roughness={0.24}
          metalness={0}
          clearcoat={richMaterials ? 0.7 : 0}
          clearcoatRoughness={0.15}
          sheen={richMaterials ? 0.3 : 0}
          sheenColor="#ff7a6a"
        />
      </mesh>
    </group>
  );
}

export function Onion() {
  const { richMaterials } = getQuality();
  const rings = useMemo(() => {
    const rand = seeded(31337);
    return [
      { r: 0.8, tube: 0.032, y: 0.4, rot: rand() * Math.PI, off: 0.06 },
      { r: 0.6, tube: 0.029, y: 0.412, rot: rand() * Math.PI, off: -0.1 },
    ];
  }, []);

  return (
    <group>
      {rings.map((r, i) => (
        <mesh
          key={i}
          position={[r.off, r.y, r.off * 0.5]}
          rotation={[Math.PI / 2, 0, r.rot]}
          castShadow
        >
          <torusGeometry args={[r.r, r.tube, 12, 64]} />
          <meshPhysicalMaterial
            color="#8d8189"
            roughness={0.44}
            metalness={0}
            clearcoat={richMaterials ? 0.4 : 0}
            clearcoatRoughness={0.3}
            sheen={richMaterials ? 0.4 : 0}
            sheenColor="#e8dced"
          />
        </mesh>
      ))}
    </group>
  );
}

export function Pickles() {
  const { richMaterials } = getQuality();
  const chips = useMemo(() => {
    const rand = seeded(8080);
    return Array.from({ length: 3 }, () => ({
      pos: [(rand() - 0.5) * 1.1, 0.5 + rand() * 0.02, (rand() - 0.5) * 1.1] as [number, number, number],
      rot: [(rand() - 0.5) * 0.24, rand() * Math.PI, (rand() - 0.5) * 0.2] as [number, number, number],
      r: 0.27 + rand() * 0.05,
    }));
  }, []);

  return (
    <group>
      {chips.map((c, i) => (
        <mesh key={i} position={c.pos} rotation={c.rot} castShadow>
          <cylinderGeometry args={[c.r, c.r, 0.055, 24]} />
          {/* Straight out of the brine, so: wet. */}
          <meshPhysicalMaterial
            color="#46601a"
            roughness={0.3}
            metalness={0}
            clearcoat={richMaterials ? 0.75 : 0}
            clearcoatRoughness={0.14}
          />
        </mesh>
      ))}
    </group>
  );
}

/** House sauce: an irregular puddle, glossy, spreading unevenly toward one side. */
export function Sauce() {
  const { richMaterials } = getQuality();
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.64, 48, 24);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const angle = Math.atan2(v.z, v.x);
      const k = 1 + Math.sin(angle * 3.2 + 0.7) * 0.09 + Math.sin(angle * 6.1) * 0.05;
      v.x *= k;
      v.z *= k;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geo} position={[0.03, 0.57, -0.02]} scale={[1, 0.075, 1]} castShadow>
      <meshPhysicalMaterial
        color="#95642a"
        roughness={0.26}
        metalness={0.02}
        clearcoat={richMaterials ? 0.8 : 0}
        clearcoatRoughness={0.12}
      />
    </mesh>
  );
}
