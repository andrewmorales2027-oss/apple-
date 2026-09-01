import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { damp, smoothstep } from '../lib/math';
import { scrollState } from '../lib/scroll';

/**
 * The page's single glass moment. A thin refractive torus orbiting the bottle
 * during section 3 — a corona ring, not a soap bubble: high transmission, gold
 * attenuation, and only a whisper of chromatic aberration on the edge.
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

  useFrame((_, delta) => {
    const g = group.current;
    // Static path: the ring is simply present, at rest, in the one frame the
    // canvas draws. No grow-in, because there is no scroll driving it.
    if (!g || !animated) return;

    const p = scrollState.active === 'corona' ? scrollState.corona : scrollState.corona > 0 ? 1 : 0;

    // Grow in over the first third of the section, hold, shrink back out.
    const presence = smoothstep(0.02, 0.34, p) * (1 - smoothstep(0.78, 1, p));
    scale.current = damp(scale.current, 0.001 + presence * 0.999, 4.5, delta);
    g.scale.setScalar(scale.current);

    g.rotation.y += delta * 0.16;
    g.rotation.z = Math.sin(performance.now() * 0.00016) * 0.16;
  });

  return (
    <group
      ref={group}
      rotation={[1.28, 0, 0.12]}
      position={[0, 0.06, 0]}
      scale={animated ? 0.001 : 1}
    >
      <mesh>
        <torusGeometry args={[1.55, 0.05, quality === 'high' ? 20 : 12, quality === 'high' ? 160 : 96]} />
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
