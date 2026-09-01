import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { seeded } from "../easing";
import { FRIES_POS } from "../layout";
import { getQuality } from "../../lib/quality";

/**
 * Hand-cut means uneven: every fry gets its own cross-section, length, bend and crust
 * shading. A row of identical extruded boxes reads as a render, not as food.
 */
function fryGeometry(rand: () => number) {
  const len = 0.72 + rand() * 0.45;
  const w = 0.088 + rand() * 0.042;
  const d = 0.082 + rand() * 0.045;
  const geo = new THREE.BoxGeometry(w, len, d, 2, 7, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const bendX = (rand() - 0.5) * 0.16;
  const bendZ = (rand() - 0.5) * 0.16;
  const twist = (rand() - 0.5) * 0.5;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = v.y / len; // -0.5 .. 0.5
    // Bend along the length, and taper the ends where they crisped up.
    v.x += bendX * (t * t * 4 - 0.25) * len;
    v.z += bendZ * (t * t * 4 - 0.25) * len;
    const taper = 1 - Math.pow(Math.abs(t) * 2, 4) * 0.28;
    v.x *= taper;
    v.z *= taper;
    // Gentle twist plus a per-vertex nick so the cut edges aren't machine-straight.
    const a = twist * t;
    const cx = v.x * Math.cos(a) - v.z * Math.sin(a);
    const cz = v.x * Math.sin(a) + v.z * Math.cos(a);
    v.x = cx + (rand() - 0.5) * 0.006;
    v.z = cz + (rand() - 0.5) * 0.006;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return { geo, len };
}

interface FrySpec {
  geo: THREE.BufferGeometry;
  pile: { pos: THREE.Vector3; rot: THREE.Euler };
  fan: { pos: THREE.Vector3; rot: THREE.Euler };
  color: THREE.Color;
  roughness: number;
}

/**
 * `spread` fans the pile out during the meal-breakdown beat so the fries read as a
 * component rather than as set dressing behind the burger.
 */
export function Fries({ spread, shown }: { spread: RefObject<number>; shown: RefObject<number> }) {
  const { geometryDetail } = getQuality();
  const count = geometryDetail <= 0.5 ? 11 : 17;
  const refs = useRef<(THREE.Group | null)[]>([]);
  const root = useRef<THREE.Group>(null);

  const fries = useMemo<FrySpec[]>(() => {
    const rand = seeded(1904);
    return Array.from({ length: count }, (_, i) => {
      const { geo, len } = fryGeometry(rand);
      const a = (i / count) * Math.PI * 2 + rand() * 0.4;

      // Piled: leaning on each other in a loose heap.
      const pileR = rand() * 0.42;
      const pile = {
        pos: new THREE.Vector3(Math.cos(a) * pileR, len * 0.42 + rand() * 0.1, Math.sin(a) * pileR),
        rot: new THREE.Euler((rand() - 0.5) * 1.5, rand() * Math.PI, (rand() - 0.5) * 1.5),
      };

      // Fanned: opened out and tipped toward the camera.
      // Opened out, but still a heap that spilled rather than a display of matchsticks:
      // tight radius, most of them still leaning, only a few laid flat.
      const fanR = 0.28 + rand() * 0.62;
      const fanA = -0.7 + (i / count) * 2.6;
      const lean = rand() < 0.65 ? -1.05 - rand() * 0.45 : -0.25 - rand() * 0.3;
      const fan = {
        pos: new THREE.Vector3(Math.cos(fanA) * fanR, len * 0.4 + rand() * 0.22, Math.sin(fanA) * fanR * 0.5),
        rot: new THREE.Euler(lean, fanA + Math.PI / 2, (rand() - 0.5) * 0.8),
      };

      // Crisp edges are darker; the fluffy interior side catches more light.
      const shade = 0.8 + rand() * 0.4;
      return {
        geo,
        pile,
        fan,
        color: new THREE.Color("#c4862c").multiplyScalar(shade),
        roughness: 0.5 + rand() * 0.32,
      };
    });
  }, [count]);

  const scratchPos = useMemo(() => new THREE.Vector3(), []);
  // Reduced motion never runs the lerp, so the pile has to start where it belongs.
  const initialSpread = useRef(THREE.MathUtils.clamp(spread.current ?? 0, 0, 1)).current;

  useFrame((_, delta) => {
    // Withheld through the hero: the opening shot is the lone crown and nothing else.
    if (root.current) root.current.visible = (shown.current ?? 1) > 0.5;
    const s = THREE.MathUtils.clamp(spread.current ?? 0, 0, 1);
    const dt = Math.min(delta, 1 / 20);
    for (let i = 0; i < fries.length; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const f = fries[i];
      scratchPos.copy(f.pile.pos).lerp(f.fan.pos, s);
      g.position.lerp(scratchPos, 1 - Math.exp(-6 * dt));
      g.rotation.x = THREE.MathUtils.lerp(f.pile.rot.x, f.fan.rot.x, s);
      g.rotation.y = THREE.MathUtils.lerp(f.pile.rot.y, f.fan.rot.y, s);
      g.rotation.z = THREE.MathUtils.lerp(f.pile.rot.z, f.fan.rot.z, s);
    }
  });

  return (
    <group ref={root} name="fries" position={FRIES_POS}>
      {fries.map((f, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={f.pile.pos.clone().lerp(f.fan.pos, initialSpread)}
          rotation={[
            THREE.MathUtils.lerp(f.pile.rot.x, f.fan.rot.x, initialSpread),
            THREE.MathUtils.lerp(f.pile.rot.y, f.fan.rot.y, initialSpread),
            THREE.MathUtils.lerp(f.pile.rot.z, f.fan.rot.z, initialSpread),
          ]}
        >
          <mesh geometry={f.geo} castShadow receiveShadow>
            <meshStandardMaterial color={f.color} roughness={f.roughness} metalness={0.02} />
          </mesh>
        </group>
      ))}
      <SaltFlakes />
    </group>
  );
}

/** Flaky salt caught on the crust — small, sharp, and only visible in the key light. */
function SaltFlakes() {
  const { geometryDetail } = getQuality();
  const count = Math.round(70 * Math.max(0.5, geometryDetail));

  const mesh = useMemo(() => {
    const rand = seeded(555);
    const m = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "#f6f1e6", roughness: 0.25, metalness: 0.05 }),
      count,
    );
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 1.1;
      pos.set(Math.cos(a) * r, 0.1 + rand() * 1.0, Math.sin(a) * r * 0.8);
      euler.set(rand() * 3, rand() * 3, rand() * 3);
      quat.setFromEuler(euler);
      const s = 0.008 + rand() * 0.012;
      scale.set(s, s * 0.45, s);
      m.setMatrixAt(i, mat.compose(pos, quat, scale));
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    return m;
  }, [count]);

  return <primitive object={mesh} />;
}
