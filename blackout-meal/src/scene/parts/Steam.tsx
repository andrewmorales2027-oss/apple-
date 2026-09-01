import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { softSprite } from "../textures";
import { seeded } from "../easing";
import { getQuality } from "../../lib/quality";

/**
 * Steam coming off the patty during the assembly beat only — additive instanced planes,
 * billboarded to the camera, drifting up and fading. Deliberately not ambient: it reads
 * as a beat because it arrives with the patty and is gone by the time the camera leaves.
 *
 * First thing cut on low-tier hardware (steamCount: 0 skips the whole system).
 */
export function Steam({ intensity }: { intensity: RefObject<number> }) {
  const { steamCount } = getQuality();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const sprite = softSprite();

  const particles = useMemo(() => {
    const rand = seeded(6161);
    return Array.from({ length: steamCount }, () => ({
      angle: rand() * Math.PI * 2,
      radius: 0.15 + rand() * 0.85,
      phase: rand(),
      speed: 0.16 + rand() * 0.16,
      rise: 1.5 + rand() * 1.6,
      size: 0.55 + rand() * 0.85,
      drift: (rand() - 0.5) * 0.5,
      warm: 0.75 + rand() * 0.25,
    }));
  }, [steamCount]);

  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
      quat: new THREE.Quaternion(),
    }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const mesh = meshRef.current;
    if (!mesh || particles.length === 0) return;

    const amount = intensity.current ?? 0;
    mesh.visible = amount > 0.01;
    if (!mesh.visible) return;

    const t = clock.elapsedTime;
    // Billboard: every puff shares the camera's orientation.
    scratch.quat.copy(camera.quaternion);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const life = (t * p.speed + p.phase) % 1;
      const spread = 1 + life * 0.9;

      scratch.pos.set(
        Math.cos(p.angle) * p.radius * spread + p.drift * life * 1.4,
        -0.15 + life * p.rise,
        Math.sin(p.angle) * p.radius * spread + p.drift * life,
      );
      const s = p.size * (0.35 + life * 1.5);
      scratch.scale.set(s, s, s);
      mesh.setMatrixAt(i, scratch.m.compose(scratch.pos, scratch.quat, scratch.scale));

      // Additive: fading means darkening. Bell curve in, bell curve out.
      const fade = Math.sin(life * Math.PI) * (1 - life * 0.35);
      const b = fade * amount * 0.16;
      scratch.color.setRGB(b * p.warm, b * 0.93 * p.warm, b * 0.86);
      mesh.setColorAt(i, scratch.color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (steamCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, steamCount]}
      frustumCulled={false}
      position={[0, 0.1, 0]}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={sprite}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
