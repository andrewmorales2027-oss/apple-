import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';

/**
 * The sky. Not a decorative gradient — it is the scene's ambient luminance,
 * and it collapses with the key light at totality and warms through the notes
 * section. Rendered as a big inverted sphere so the camera is always inside it.
 */
const vertexShader = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vPos;
  uniform float uBrightness;
  uniform vec3 uTint;

  void main() {
    vec3 dir = normalize(vPos);

    // A breath of light at eye level, gone almost immediately. Deliberately
    // narrow and dim: the ground here is near-black, not a navy gradient.
    float horizon = 1.0 - abs(dir.y);
    float glow = pow(clamp(horizon, 0.0, 1.0), 9.0);

    vec3 base = vec3(0.012, 0.013, 0.017);
    vec3 col = base + uTint * glow * uBrightness * 0.3;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const Backdrop = forwardRef<THREE.ShaderMaterial>(function Backdrop(_props, ref) {
  const uniforms = useMemo(
    () => ({
      uBrightness: { value: 1 },
      uTint: { value: new THREE.Color('#1b2740') },
    }),
    [],
  );

  return (
    <mesh renderOrder={-2}>
      <sphereGeometry args={[42, 32, 24]} />
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  );
});
