import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { damp, smoothstep } from '../lib/math';
import { scrollState } from '../lib/scroll';

const TORUS_AXIS = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const CENTRE = new THREE.Vector3(0, 0.06, 0);

/** How far the ring's axis leans off the view axis. cos(54°) ≈ 0.59, which is
 *  the ellipse the ring presents — open enough to read as a ring, closed enough
 *  to read as an orbit. */
const LEAN = 0.95;

/**
 * The page's single glass moment. A thin refractive torus orbiting the bottle
 * during section 3 — a corona ring, not a soap bubble: high transmission, gold
 * attenuation, and only a whisper of chromatic aberration on the edge.
 *
 * Its orientation is camera-relative rather than a spin about world Y. Spinning
 * a tilted ring in world space swings it edge-on to the camera twice per
 * revolution, where a torus stops reading as a ring and starts reading as a rod
 * lying across the bottle. Holding the axis at a fixed lean off the view
 * direction and precessing that lean instead keeps the silhouette constant: it
 * is always the same open ellipse, and the motion reads as an orbit.
 *
 * Cost control:
 *  - mounted only while section 3 is within ~60% of the viewport (App gates it)
 *  - `samples`/`resolution` are halved on the low-quality path
 *  - on low-end hardware it falls back to a plain physical material with no
 *    transmission pass at all, which looks like glass and costs nothing extra
 */
export function CoronaRing({
  quality,
  animated,
}: {
  quality: 'high' | 'low';
  animated: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const scale = useRef(animated ? 0.001 : 1);
  const phi = useRef(0.6);

  const v = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      normal: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;

    if (animated) {
      const p =
        scrollState.active === 'corona' ? scrollState.corona : scrollState.corona > 0 ? 1 : 0;

      // Grow in over the first third of the section, hold, shrink back out.
      const presence = smoothstep(0.02, 0.34, p) * (1 - smoothstep(0.78, 1, p));
      scale.current = damp(scale.current, 0.001 + presence * 0.999, 4.5, delta);
      g.scale.setScalar(scale.current);

      phi.current += delta * 0.42;
    }

    // Camera-relative basis, then lean the ring's axis off it by LEAN and
    // precess that lean around the view direction.
    v.forward.copy(camera.position).sub(CENTRE).normalize();
    v.right.crossVectors(v.forward, WORLD_UP).normalize();
    v.up.crossVectors(v.right, v.forward).normalize();

    v.normal
      .copy(v.forward)
      .multiplyScalar(Math.cos(LEAN))
      .addScaledVector(v.right, Math.cos(phi.current) * Math.sin(LEAN))
      .addScaledVector(v.up, Math.sin(phi.current) * Math.sin(LEAN))
      .normalize();

    g.quaternion.setFromUnitVectors(TORUS_AXIS, v.normal);
  });

  return (
    <group ref={group} position={[0, 0.06, 0]} scale={animated ? 0.001 : 1}>
      <mesh>
        <torusGeometry
          args={[1.3, 0.045, quality === 'high' ? 20 : 12, quality === 'high' ? 160 : 96]}
        />
        {quality === 'high' ? (
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.35}
            roughness={0.06}
            ior={1.42}
            chromaticAberration={0.045}
            anisotropicBlur={0.1}
            distortion={0.12}
            distortionScale={0.3}
            temporalDistortion={0}
            samples={4}
            resolution={256}
            backside={false}
            attenuationColor="#c8a04a"
            attenuationDistance={2.2}
            color="#ffffff"
          />
        ) : (
          // No extra render target, no refraction pass. Reads as thin glass
          // catching the rim light; costs the same as any opaque mesh.
          <meshPhysicalMaterial
            color="#d8dce8"
            metalness={0}
            roughness={0.08}
            transparent
            opacity={0.3}
            envMapIntensity={2.4}
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        )}
      </mesh>
    </group>
  );
}
