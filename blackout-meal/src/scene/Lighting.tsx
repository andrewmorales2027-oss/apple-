import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { getQuality } from "../lib/quality";
import { BOTTLE_POS } from "./layout";
import { createStudioEnvironment } from "./environment";
import { getStyle } from "./style";

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
    scene.environmentIntensity = getStyle().envIntensity;
    return () => {
      scene.environment = previous;
      env.dispose();
    };
  }, [scene, env]);

  return null;
}

/**
 * Flat rig, for the toon-shaded directions.
 *
 * MeshToonMaterial has no envMap term at all, so the HDR environment that lights every
 * PBR surface contributes exactly nothing to it — which is why a toon pass under the
 * photoreal rig comes out as black shapes with lit rims. These directions get real lamps
 * and a high ambient floor instead, which is also how cel animation is actually lit:
 * broad flat key, minimal falloff, shadow used as a shape not as darkness.
 */
function FlatRig({ keyMul, rimMul, shadows }: {
  keyMul: number;
  rimMul: number;
  shadows: boolean;
}) {
  return (
    <>
      {/* Kept near unit irradiance. MeshToonMaterial is albedo x irradiance with no
          highlight rolloff, so lighting it at 3x the way a PBR scene is lit doesn't make
          it brighter, it makes every colour climb its own hue ramp — which is how a
          charcoal bun and a brown patty both arrive as red.

          Neutral and near-white, deliberately. In a flat style the surface's own colour is
          the entire read — there is no specular or texture left to identify an ingredient
          by — so tinted fills stop being atmosphere and start being wrong information: a
          red kicker turns the patty, the bun and the lettuce into one red mass. */}
      <ambientLight intensity={0.34 * keyMul} color="#ffffff" />
      <directionalLight
        position={[5, 7.5, 4.5]}
        intensity={0.88 * keyMul}
        color="#fffdf8"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0015}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-6, 3, -4]} intensity={0.22 * rimMul} color="#dce8ff" />
    </>
  );
}

/** Photoreal rig: hard key for the shadow, rims for separation, environment for specular. */
function PbrRig({ keyMul, rimMul, shadows, tier, accent, neonRims }: {
  keyMul: number;
  rimMul: number;
  shadows: boolean;
  tier: string;
  accent: string;
  neonRims: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.1} color="#4a3220" />

      {/* Key. Carries the hard shadow; the environment carries its specular. */}
      <spotLight
        position={[5.2, 7.4, 4.6]}
        angle={0.52}
        penumbra={0.55}
        intensity={230 * keyMul}
        distance={30}
        color="#fff2df"
        castShadow={shadows}
        shadow-mapSize={tier === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-radius={4}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />

      {/* Cool rim, back-left: carves the black bun off the black background. */}
      <spotLight position={[-6.4, 3.4, -5.2]} angle={0.7} penumbra={0.85} intensity={140 * rimMul} color="#bcd4e8" />

      {/* Hot rim, back-right: the one place the accent appears in the lighting. */}
      <pointLight position={[4.2, 1.1, -4.8]} intensity={26 * rimMul} distance={16} color={accent} />

      {/* Low bounce off the table. Kept clear of the ground plane — sitting a light on it
          burns a hotspot. */}
      <pointLight position={[0, -0.35, 2.8]} intensity={5} distance={7} color="#6b4a2a" />

      {/* Saturated cross-rims: the whole point of the neon direction, and actively wrong
          in every other one, so they are gated rather than dimmed. */}
      {neonRims && (
        <>
          <pointLight position={[-3.6, 2.2, -2.4]} intensity={120} distance={12} color="#00e5ff" />
          <pointLight position={[3.4, 2.6, -3.2]} intensity={110} distance={12} color="#ff2d6f" />
          <pointLight position={[0, -0.9, -3.6]} intensity={45} distance={9} color="#7a5cff" />
        </>
      )}

      {/* Beverage-shot backlight: a dark bottle in a dark room is a silhouette, and the
          cola only reads as cola with something behind it to burn through. */}
      <pointLight
        position={[BOTTLE_POS.x + 0.4, BOTTLE_POS.y + 2.05, BOTTLE_POS.z - 1.75]}
        intensity={34}
        distance={3.4}
        decay={2}
        color="#ffb46a"
      />

      {/* Edge light down the left of the glass — the highlight that says "glass". */}
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

export function Lighting() {
  const { shadows, tier } = getQuality();
  const style = getStyle();
  const castShadows = shadows && style.shadows;
  const flat = style.shading === "toon";

  return (
    <>
      {/* The environment still drives the PBR directions; toon ignores it, which costs
          nothing to leave mounted and keeps the glass reflecting in the mixed cases. */}
      <StudioEnvironment />

      {flat ? (
        <FlatRig keyMul={style.keyMul} rimMul={style.rimMul} shadows={castShadows} />
      ) : (
        <PbrRig
          keyMul={style.keyMul}
          rimMul={style.rimMul}
          shadows={castShadows}
          tier={tier}
          accent={style.css.accent}
          neonRims={style.neonRims}
        />
      )}
    </>
  );
}
