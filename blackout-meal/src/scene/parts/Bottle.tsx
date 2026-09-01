import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import { colaLabel } from "../textures";
import { seeded } from "../easing";
import { getQuality } from "../../lib/quality";
import { BOTTLE_POS } from "../layout";

/** Outer silhouette of the bottle, bottom to lip, as (radius, height) pairs. */
const OUTER: [number, number][] = [
  [0.0, 0.0],
  [0.34, 0.0],
  [0.42, 0.04],
  [0.44, 0.12],
  [0.445, 0.86],
  [0.4, 1.14],
  [0.376, 1.3],
  [0.414, 1.56],
  [0.425, 1.86],
  [0.39, 2.06],
  [0.29, 2.29],
  [0.187, 2.49],
  [0.176, 2.66],
  [0.206, 2.7],
  [0.206, 2.76],
];

/** Mouth cavity, so the glass reads as a hollow vessel rather than a solid lathe. */
const MOUTH: [number, number][] = [
  [0.152, 2.76],
  [0.148, 2.5],
  [0.15, 2.3],
  [0.0, 2.24],
];

const FILL_HEIGHT = 1.86; // ~70% of the interior volume

/**
 * Lathing the profile points directly leaves visible facet bands across the shoulder and
 * neck, because each authored corner becomes a hard normal break. Resampling the profile
 * through a spline first rounds those transitions the way real moulded glass is rounded,
 * and costs nothing at runtime.
 */
function smoothProfile(points: [number, number][], samples: number) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getSpacedPoints(samples);
}

function lathe(points: THREE.Vector2[], segments: number) {
  return new THREE.LatheGeometry(points, segments);
}

/** Linear interpolation of the outer profile — used to stick droplets to the surface. */
function radiusAt(y: number) {
  for (let i = 1; i < OUTER.length; i++) {
    const [r0, y0] = OUTER[i - 1];
    const [r1, y1] = OUTER[i];
    if (y >= y0 && y <= y1) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return r0 + (r1 - r0) * t;
    }
  }
  return OUTER[OUTER.length - 1][0];
}

/** Local surface slope, so droplets lie flat against the glass instead of poking through. */
function normalAt(y: number) {
  const d = 0.02;
  const dr = radiusAt(Math.min(2.7, y + d)) - radiusAt(Math.max(0, y - d));
  return new THREE.Vector2(1, -dr / (2 * d)).normalize();
}

interface DropletSet {
  matrices: THREE.Matrix4[];
}

function buildDroplets(count: number, seed: number): DropletSet {
  const rand = seeded(seed);
  const matrices: THREE.Matrix4[] = [];
  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    // Bias toward the body of the bottle where condensation actually collects.
    const y = 0.1 + Math.pow(rand(), 0.85) * 2.15;
    const theta = rand() * Math.PI * 2;
    const r = radiusAt(y);
    const slope = normalAt(y);

    nrm.set(Math.cos(theta) * slope.x, slope.y, Math.sin(theta) * slope.x).normalize();
    pos.set(Math.cos(theta) * r, y, Math.sin(theta) * r).addScaledVector(nrm, 0.004);

    quat.setFromUnitVectors(up, nrm);
    const s = 0.008 + Math.pow(rand(), 2.4) * 0.03;
    // Beads sag: taller than they are wide.
    scale.set(s, s * (0.35 + rand() * 0.4), s * (1 + rand() * 0.7));
    matrices.push(new THREE.Matrix4().compose(pos, quat, scale));
  }
  return { matrices };
}

function DropletLayer({
  count,
  seed,
  roughness,
  density,
}: {
  count: number;
  seed: number;
  roughness: number;
  density: RefObject<number>;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { matrices } = useMemo(() => buildDroplets(count, seed), [count, seed]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // Density climbs as the section plays: the bottle keeps sweating while you look at it.
    const d = THREE.MathUtils.clamp(density.current ?? 0, 0, 1);
    mesh.count = Math.round(count * (0.3 + d * 0.7));
    mesh.visible = mesh.count > 0;
  });

  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el;
        if (el) {
          matrices.forEach((m, i) => el.setMatrixAt(i, m));
          el.instanceMatrix.needsUpdate = true;
          el.frustumCulled = false;
        }
      }}
      args={[undefined, undefined, count]}
    >
      <sphereGeometry args={[1, 8, 6]} />
      <meshPhysicalMaterial
        color="#eef6ff"
        roughness={roughness}
        metalness={0}
        transmission={0.35}
        thickness={0.02}
        ior={1.33}
        transparent
        opacity={0.95}
      />
    </instancedMesh>
  );
}

/**
 * The one hero glass moment on the page. MeshTransmissionMaterial re-renders the scene
 * into an off-screen buffer for real refraction, so it lives here and nowhere else —
 * and drops to a cheap physical-material approximation on low-tier hardware.
 */
export function Bottle({
  condensation,
  lift,
  shown,
}: {
  condensation: RefObject<number>;
  lift: RefObject<number>;
  shown: RefObject<number>;
}) {
  const q = getQuality();
  const group = useRef<THREE.Group>(null);

  const segments = Math.round(72 * Math.max(0.6, q.geometryDetail));
  const glassGeo = useMemo(
    () => lathe(smoothProfile([...OUTER, ...MOUTH], 96), segments),
    [segments],
  );
  const liquidGeo = useMemo(() => {
    const pts: [number, number][] = OUTER.filter(([, y]) => y <= FILL_HEIGHT).map(([r, y]) => [
      r * 0.93,
      y + 0.02,
    ]);
    pts.push([radiusAt(FILL_HEIGHT) * 0.93, FILL_HEIGHT]);
    const smoothed = smoothProfile(pts, 64);
    // Flat surface across the top, added after smoothing so the meniscus stays level.
    smoothed.push(new THREE.Vector2(0, FILL_HEIGHT));
    return lathe(smoothed, segments);
  }, [segments]);

  const label = colaLabel();

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    g.visible = (shown.current ?? 1) > 0.5;
    const target = lift.current ?? 0;
    g.position.y = THREE.MathUtils.damp(
      g.position.y,
      BOTTLE_POS.y + target * 0.55,
      4,
      Math.min(delta, 1 / 20),
    );
  });

  return (
    <group ref={group} name="bottle" position={BOTTLE_POS} rotation={[0, -0.35, 0]}>
      {/* Liquid first: it has to exist in the buffer the glass refracts. */}
      <mesh geometry={liquidGeo}>
        <meshPhysicalMaterial
          color="#4a1206"
          roughness={0.12}
          metalness={0}
          transmission={q.transmission ? 0.25 : 0}
          thickness={0.7}
          ior={1.34}
          attenuationColor="#5c1806"
          attenuationDistance={0.9}
        />
      </mesh>

      <mesh geometry={glassGeo} castShadow>
        {q.transmission ? (
          <MeshTransmissionMaterial
            name="bottle-glass"
            transmission={0.97}
            thickness={0.16}
            roughness={0.06}
            ior={1.52}
            chromaticAberration={0.035}
            anisotropicBlur={0.1}
            distortion={0.08}
            distortionScale={0.25}
            temporalDistortion={0}
            resolution={q.transmissionResolution}
            samples={q.tier === "high" ? 6 : 4}
            backside
            backsideThickness={0.12}
            color="#f4faf7"
            attenuationColor="#cfe2d8"
            attenuationDistance={9}
          />
        ) : (
          <meshPhysicalMaterial
            name="bottle-glass"
            color="#8fa89b"
            roughness={0.08}
            metalness={0}
            transparent
            opacity={0.42}
            transmission={0}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>

      {/* Wrap label. */}
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[0.452, 0.452, 0.66, segments, 1, true]} />
        <meshStandardMaterial
          map={label}
          emissiveMap={label}
          emissive="#ffffff"
          emissiveIntensity={0.3}
          roughness={0.55}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Crimped crown cap. */}
      <mesh position={[0, 2.79, 0]}>
        <cylinderGeometry args={[0.222, 0.222, 0.11, 21]} />
        <meshStandardMaterial color="#c81e2c" roughness={0.34} metalness={0.55} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.03, 21]} />
        <meshStandardMaterial color="#8e131e" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Two populations rather than one: fat glossy beads over a fine matte haze, which
          is what gives the surface its roughness variance without a per-instance shader. */}
      <DropletLayer count={Math.round(q.dropletCount * 0.4)} seed={2201} roughness={0.05} density={condensation} />
      <DropletLayer count={Math.round(q.dropletCount * 0.6)} seed={9143} roughness={0.62} density={condensation} />
    </group>
  );
}
