import { useMemo } from 'react';
import * as THREE from 'three';

/** The bottle is 100% procedural — no asset fetch, no GLTF, no sprite. */
export const BOTTLE = {
  /** Black glass cylinder, flat-cut like a coin. */
  radius: 1.0,
  halfHeight: 0.275,
  /** Brushed-gold disc cap, sitting slightly off-axis on the top face. */
  capRadius: 0.4,
  capHalfHeight: 0.035,
  capOffsetX: 0.3,
  /** Cap centre, i.e. 0.275 (top face) + 0.035 (half its own thickness). */
  get capY() {
    return this.halfHeight + this.capHalfHeight;
  },
} as const;

/**
 * Lathe profile for a coin-shaped solid with a small fillet on both rims —
 * a razor-sharp edge is the tell that a "product render" is really a primitive.
 */
function coinProfile(radius: number, halfHeight: number, fillet: number, seg = 8) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -halfHeight)];
  pts.push(new THREE.Vector2(radius - fillet, -halfHeight));

  for (let i = 1; i <= seg; i++) {
    const a = -Math.PI / 2 + (i / seg) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(
        radius - fillet + Math.cos(a) * fillet,
        -halfHeight + fillet + Math.sin(a) * fillet,
      ),
    );
  }
  for (let i = 1; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(
        radius - fillet + Math.cos(a) * fillet,
        halfHeight - fillet + Math.sin(a) * fillet,
      ),
    );
  }
  pts.push(new THREE.Vector2(0, halfHeight));
  return pts;
}

export function Bottle() {
  const bodyGeometry = useMemo(
    () => new THREE.LatheGeometry(coinProfile(BOTTLE.radius, BOTTLE.halfHeight, 0.045), 128),
    [],
  );

  const capGeometry = useMemo(
    () => new THREE.LatheGeometry(coinProfile(BOTTLE.capRadius, BOTTLE.capHalfHeight, 0.012), 96),
    [],
  );

  return (
    <group>
      {/* Matte black glass body. */}
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#0a0b0d"
          roughness={0.35}
          metalness={0}
          clearcoat={0.35}
          clearcoatRoughness={0.55}
          reflectivity={0.35}
          envMapIntensity={0.9}
        />
      </mesh>

      {/* The one piece of gold linework on the body: a hairline seam at the
          equator. Thin enough that bloom renders it as a drawn line. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BOTTLE.radius + 0.002, 0.0045, 8, 220]} />
        <meshStandardMaterial
          color="#c8a04a"
          metalness={1}
          roughness={0.28}
          envMapIntensity={1.6}
        />
      </mesh>

      {/* Brushed-gold disc cap, off-axis. This is what gets eclipsed. */}
      <mesh
        geometry={capGeometry}
        position={[BOTTLE.capOffsetX, BOTTLE.capY, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#c8a04a"
          metalness={1}
          roughness={0.2}
          anisotropy={0.65}
          anisotropyRotation={Math.PI / 2}
          envMapIntensity={1.35}
        />
      </mesh>
    </group>
  );
}
