import { Environment, Lightformer } from "@react-three/drei";
import { getQuality } from "../lib/quality";
import { BOTTLE_POS } from "./layout";

/**
 * One hard key light, two rims, almost no fill — the liquor-ad setup. The rims matter
 * more than usual here: the crown of the bun is nearly the same value as the background,
 * so without an edge separating it the silhouette disappears into the black.
 *
 * The environment is built from Lightformers rather than an HDR file, so nothing is
 * fetched over the network and a cold checkout renders the finished scene.
 */
export function Lighting() {
  const { shadows, tier } = getQuality();

  return (
    <>
      <ambientLight intensity={0.1} color="#4a3220" />

      {/* Key: high, front-right, hard. */}
      <spotLight
        position={[5.2, 7.4, 4.6]}
        angle={0.52}
        penumbra={0.35}
        intensity={260}
        distance={30}
        color="#fff2df"
        castShadow={shadows}
        shadow-mapSize={tier === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />

      {/* Cool rim, back-left: carves the black bun off the black background. */}
      <spotLight position={[-6.4, 3.4, -5.2]} angle={0.7} penumbra={0.8} intensity={150} color="#bcd4e8" />

      {/* Hot rim, back-right: the one place the accent red appears in the lighting. */}
      <pointLight position={[4.2, 1.1, -4.8]} intensity={26} distance={16} color="#c81e2c" />

      {/* Low bounce off the table, just enough to keep the underside from going to zero.
          Kept clear of the ground plane — sitting a light on it burns a hotspot. */}
      <pointLight position={[0, -0.35, 2.8]} intensity={7} distance={7} color="#6b4a2a" />

      {/* Beverage-shot backlight. A dark bottle in a dark room is a silhouette; the cola
          only reads as cola when there is something behind it to burn through. Short
          throw so it lights the glass and not the burger. */}
      <pointLight
        position={[BOTTLE_POS.x + 0.4, BOTTLE_POS.y + 2.05, BOTTLE_POS.z - 1.75]}
        intensity={30}
        distance={3.2}
        decay={2}
        color="#ffb46a"
      />

      {/* Edge light down the left of the glass. A bottle without a specular rim reads as
          a dark shape; this is the highlight that says "glass". */}
      <pointLight
        position={[BOTTLE_POS.x - 2.1, BOTTLE_POS.y + 2.4, BOTTLE_POS.z - 0.9]}
        intensity={22}
        distance={4.2}
        decay={2}
        color="#cfe6ff"
      />

      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[4, 6, 4]} scale={[8, 8, 1]} color="#fff1de" />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, -4]} scale={[8, 5, 1]} color="#8fb2d0" />
        <Lightformer form="circle" intensity={1.6} position={[3, 0.5, -5]} scale={3} color="#c81e2c" />
        <Lightformer form="rect" intensity={0.35} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} color="#2a1a12" />
      </Environment>
    </>
  );
}
