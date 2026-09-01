import { forwardRef, useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { BOTTLE } from './Bottle';

/**
 * The corona.
 *
 * It is centred on the *gold cap*, not on the bottle — so when the cylinder
 * eclipses the cap, what survives is a thin gold arc cresting over the black
 * rim, at the cap's own scale. The bottle's motif and the eclipse motif are
 * the same shape, and this is where that pays off.
 *
 * Additive, depthWrite off: the cylinder occludes it by depth test alone,
 * exactly like the real thing. No masking, no fade.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform vec3 uColor;

  void main() {
    float d = length(vUv - 0.5) * 2.0;

    // A hot, thin ring just outside the cap's edge, plus a faint atmospheric
    // bleed. Corona-thin — anything wider reads as a lens flare.
    float ring = smoothstep(0.35, 0.405, d) * (1.0 - smoothstep(0.42, 0.56, d));
    float halo = (1.0 - smoothstep(0.36, 1.0, d)) * 0.13;

    float a = (ring + halo) * uOpacity;
    if (a <= 0.002) discard;

    gl_FragColor = vec4(uColor * a, a);
  }
`;

export const CoronaGlow = forwardRef<THREE.ShaderMaterial>(function CoronaGlow(_props, ref) {
  const uniforms = useMemo(
    () => ({
      uOpacity: { value: 0 },
      // Over-unity so this is the page's single blown-out highlight and the
      // only thing above the bloom threshold.
      uColor: { value: new THREE.Color('#e8c27a').multiplyScalar(2.6) },
    }),
    [],
  );

  return (
    <Billboard position={[BOTTLE.capOffsetX, BOTTLE.capY, 0]}>
      <mesh>
        <planeGeometry args={[2.3, 2.3]} />
        <shaderMaterial
          ref={ref}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
});
