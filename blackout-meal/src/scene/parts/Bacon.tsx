import { useMemo } from "react";
import * as THREE from "three";
import { baconNormal } from "../textures";
import { seeded } from "../easing";
import { getQuality } from "../../lib/quality";

/**
 * Hand-rolled ribbon sweep. ExtrudeGeometry can follow a path but can't twist along it,
 * and untwisted bacon reads as a flat sticker — the curl is the whole point. This walks
 * the curve, rotates the cross-section frame as it goes, and emits a closed rectangular
 * tube.
 */
function ribbonGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  width: number,
  thickness: number,
  twist: number,
  segments: number,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const binormal = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const corner = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tangent).normalize();

    binormal.crossVectors(tangent, up);
    if (binormal.lengthSq() < 1e-6) binormal.set(1, 0, 0);
    binormal.normalize();
    normal.crossVectors(binormal, tangent).normalize();

    // Twist the frame about the tangent — this is the curl.
    const angle = twist * Math.sin(t * Math.PI * 1.6) + twist * 0.4 * (t - 0.5);
    binormal.applyAxisAngle(tangent, angle);
    normal.applyAxisAngle(tangent, angle);

    // Bacon narrows and thins toward the ends where it shrank on the grill.
    const taper = 0.72 + 0.28 * Math.sin(t * Math.PI);
    const hw = (width / 2) * taper;
    const ht = (thickness / 2) * taper;

    // Four corners, in order, so the side quads wind consistently.
    const offsets: [number, number][] = [
      [-hw, ht],
      [hw, ht],
      [hw, -ht],
      [-hw, -ht],
    ];
    for (let c = 0; c < 4; c++) {
      const [ob, on] = offsets[c];
      corner.copy(p).addScaledVector(binormal, ob).addScaledVector(normal, on);
      positions.push(corner.x, corner.y, corner.z);
      uvs.push(c / 3, t * 3);
    }

    if (i < segments) {
      const a = i * 4;
      const b = (i + 1) * 4;
      for (let c = 0; c < 4; c++) {
        const c2 = (c + 1) % 4;
        indices.push(a + c, b + c, b + c2, a + c, b + c2, a + c2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function Bacon() {
  const { geometryDetail, richMaterials } = getQuality();

  const strips = useMemo(() => {
    const rand = seeded(777);
    const segments = Math.round(56 * geometryDetail);

    return Array.from({ length: 3 }, (_, i) => {
      const bias = (i - 1) * 0.42;
      const yaw = (rand() - 0.5) * 0.7 + i * 0.25;
      // A wavy run across the patty: it lifts in the middle and curls at the ends.
      const pts = [
        new THREE.Vector3(-0.98, 0.02, bias - 0.14),
        new THREE.Vector3(-0.55, 0.09, bias + 0.09),
        new THREE.Vector3(-0.1, 0.02, bias - 0.07),
        new THREE.Vector3(0.4, 0.11, bias + 0.1),
        new THREE.Vector3(0.85, 0.04, bias - 0.09),
        new THREE.Vector3(1.06, 0.12, bias + 0.05),
      ].map((v) => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));

      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
      return ribbonGeometry(curve, 0.27 + rand() * 0.05, 0.045, 0.55 + rand() * 0.4, segments);
    });
  }, [geometryDetail]);

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#7d2614",
        roughness: 0.52,
        metalness: 0.03,
        // Bacon comes off the grill still glossed in its own fat.
        clearcoat: richMaterials ? 0.45 : 0,
        clearcoatRoughness: 0.35,
        normalMap: baconNormal(),
        normalScale: new THREE.Vector2(1.2, 1.2),
      }),
    [richMaterials],
  );

  return (
    <group position={[0, 0.19, 0]}>
      {strips.map((geo, i) => (
        <mesh key={i} geometry={geo} material={material} castShadow receiveShadow />
      ))}
    </group>
  );
}
