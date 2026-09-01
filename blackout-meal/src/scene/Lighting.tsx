import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { getQuality } from "../lib/quality";
import { BOTTLE_POS } from "./layout";
import { createStudioEnvironment } from "./environment";

/**
 * Image-based lighting from a generated HDR studio map, plus a small number of real
 * lights for the shaping the environment can't do on its own.
 *
 * The balance matters: the environment supplies the specular character — the long strip
 * reflection, the soft key rolloff, the ambient that keeps shadows from crushing — while
 * the discrete lights supply the hard shadow and the rim separation. Lighting a scene
 * entirely with lamps is what makes it read as CG; lighting it entirely with an
 * environment makes it read as flat and shadowless.
 */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  const { envResolution } = getQuality();

  const env = useMemo(() => createStudioEnvironment(gl, envResolution), [gl, envResolution]);

  useEffect(() => {
    const previous = scene.environment;
    scene.environment = env;
    scene.environmentIntensity = 1.9;
    return () => {
      scene.environment = previous;
      env.dispose();
    };
  }, [scene, env]);

  return null;
}

export function Lighting() {
  const { shadows, tier } = getQuality();

  return (
    <>
      <StudioEnvironment />

      {/* Key. Carries the hard shadow; the environment carries its specular. Kept lower
          in intensity than before because the HDR map is now doing most of the lifting. */}
      <spotLight
        position={[5.2, 7.4, 4.6]}
        angle={0.52}
        penumbra={0.55}
        intensity={230}
        distance={30}
        color="#fff2df"
        castShadow={shadows}
        shadow-mapSize={tier === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-radius={4}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />

      {/* Cool rim, back-left: carves the black bun off the black background. */}
      <spotLight position={[-6.4, 3.4, -5.2]} angle={0.7} penumbra={0.85} intensity={140} color="#bcd4e8" />

      {/* Hot rim, back-right: the one place the accent red appears in the lighting. */}
      <pointLight position={[4.2, 1.1, -4.8]} intensity={26} distance={16} color="#c81e2c" />

      {/* Low bounce off the table, just enough to keep the underside from going to zero.
          Kept clear of the ground plane — sitting a light on it burns a hotspot. */}
      <pointLight position={[0, -0.35, 2.8]} intensity={5} distance={7} color="#6b4a2a" />

      {/* Beverage-shot backlight. A dark bottle in a dark room is a silhouette; the cola
          only reads as cola when there is something behind it to burn through. Short
          throw so it lights the glass and not the burger. */}
      <pointLight
        position={[BOTTLE_POS.x + 0.4, BOTTLE_POS.y + 2.05, BOTTLE_POS.z - 1.75]}
        intensity={34}
        distance={3.4}
        decay={2}
        color="#ffb46a"
      />

      {/* Edge light down the left of the glass. A bottle without a specular rim reads as
          a dark shape; this is the highlight that says "glass". */}
      <pointLight
        position={[BOTTLE_POS.x - 2.1, BOTTLE_POS.y + 2.4, BOTTLE_POS.z - 0.9]}
        intensity={18}
        distance={4.2}
        decay={2}
        color="#cfe6ff"
      />
    </>
  );
}
