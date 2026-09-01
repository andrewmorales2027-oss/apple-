import { useMemo } from "react";
import * as THREE from "three";
import { bunNormal } from "../textures";
import { seeded } from "../easing";
import { getQuality } from "../../lib/quality";

/**
 * Brioche, squashed-sphere. The bottom is a warm toasted brown; the crown is the
 * charcoal black-sesame top the meal is named for, kept just off pure black so the key
 * light and rim light can still carve its silhouette out of the #0a0605 background.
 */

/**
 * A sliced bun is a dome with a flat face, not a whole sphere. Modelling it as a full
 * squashed sphere and laying a disc on top makes the disc stick out past the silhouette
 * like a brim, so each half is a hemisphere capped at full radius by its cut face.
 */
export function BottomBun() {
  const { richMaterials } = getQuality();
  const normal = bunNormal();
  return (
    <group position={[0, -0.68, 0]}>
      <mesh scale={[1, 0.4, 1]} castShadow receiveShadow>
        {/* Lower hemisphere: phiStart PI/2, phiLength PI/2. */}
        <sphereGeometry args={[1.05, 64, 28, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#8a5326"
          roughness={0.58}
          metalness={0}
          // Egg-washed brioche has a faint satin skin, not a lacquer.
          clearcoat={richMaterials ? 0.22 : 0}
          clearcoatRoughness={0.6}
          sheen={richMaterials ? 0.25 : 0}
          sheenColor="#c98c46"
          normalMap={normal}
          normalScale={new THREE.Vector2(0.6, 0.6)}
        />
      </mesh>
      {/* Cut face: the sliced, lightly griddled inside of the bun. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.05, 64]} />
        <meshStandardMaterial
          color="#c19a63"
          roughness={0.92}
          normalMap={normal}
          normalScale={new THREE.Vector2(0.35, 0.35)}
        />
      </mesh>
    </group>
  );
}

const CROWN_R = 1.16;
const CROWN_SQUASH = 0.52;

/** Sesame seeds scattered over the crown of the squashed sphere, as one InstancedMesh. */
function useSesameMesh(count: number) {
  return useMemo(() => {
    const rand = seeded(90210);
    const pos = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const spin = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4();

    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshStandardMaterial({ color: "#4a3a2e", roughness: 0.28, metalness: 0.04 }),
      count,
    );

    for (let i = 0; i < count; i++) {
      // Weighted toward the pole so the crown reads seeded and the sides stay clean.
      const phi = Math.acos(1 - rand() * 0.8);
      const theta = rand() * Math.PI * 2;
      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.sin(theta);

      pos.set(sx * CROWN_R, sy * CROWN_R * CROWN_SQUASH, sz * CROWN_R);
      // Ellipsoid gradient -> true surface normal of the squashed sphere.
      nrm.set(sx / CROWN_R, sy / (CROWN_R * CROWN_SQUASH), sz / CROWN_R).normalize();
      pos.addScaledVector(nrm, 0.014);

      quat.setFromUnitVectors(up, nrm);
      spin.setFromAxisAngle(up, rand() * Math.PI);
      quat.multiply(spin);

      const s = 0.026 + rand() * 0.015;
      scale.set(s * 1.75, s * 0.6, s);
      mesh.setMatrixAt(i, m.compose(pos, quat, scale));
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }, [count]);
}

export function TopBun() {
  const { sesameCount, richMaterials } = getQuality();
  const normal = bunNormal();
  const sesame = useSesameMesh(sesameCount);

  return (
    <group position={[0, 0.6, 0]}>
      <mesh scale={[1, CROWN_SQUASH, 1]} castShadow>
        {/* Upper hemisphere only — the flat face below is the slice. */}
        <sphereGeometry args={[CROWN_R, 64, 30, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#191110"
          roughness={0.5}
          metalness={0}
          // Satin, not lacquered: a broad soft highlight is what bread crust does.
          clearcoat={richMaterials ? 0.3 : 0}
          clearcoatRoughness={0.55}
          sheen={richMaterials ? 0.4 : 0}
          sheenColor="#6b4326"
          normalMap={normal}
          normalScale={new THREE.Vector2(0.55, 0.55)}
        />
      </mesh>
      <primitive object={sesame} />
      {/* Cut face underneath. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CROWN_R, 64]} />
        <meshStandardMaterial
          color="#b8905c"
          roughness={0.94}
          normalMap={normal}
          normalScale={new THREE.Vector2(0.35, 0.35)}
        />
      </mesh>
    </group>
  );
}
