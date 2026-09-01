import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Burger } from "./Burger";
import { Bottle } from "./parts/Bottle";
import { Fries } from "./parts/Fries";
import { CameraRig, StaticCamera } from "./CameraRig";
import { Lighting } from "./Lighting";
import { Effects } from "./Effects";
import { onSectionProgress, scrollState } from "./scrollState";
import { clamp01, smoothstep } from "./easing";
import { getQuality } from "../lib/quality";
import { GROUND_Y } from "./layout";
import { getStyle } from "./style";
import { StyleOverride } from "./StyleOverride";

/** Shared by the rig's final aim and OrbitControls, so the handover is seamless. */
const ORBIT_TARGET: [number, number, number] = [0, -0.45, 0];

/**
 * Reduced motion mounts OrbitControls straight away, and OrbitControls aims at its own
 * target — so this has to match StaticCamera's lookAt or the still framing is silently
 * overridden and the meal drifts back under the wordmark. Above the meal, so the meal
 * sits in the lower half with the copy clear above it.
 */
const STILL_ORBIT_TARGET: [number, number, number] = [0.9, 2.2, 0];

/**
 * Turns raw scroll into the handful of numbers the props actually consume. Lives inside
 * the Canvas so it runs on the frame loop, never on React's render path.
 */
function PropDirector({
  reduced,
  condensation,
  friesSpread,
  bottleLift,
  propsShown,
}: {
  reduced: boolean;
  condensation: React.RefObject<number>;
  friesSpread: React.RefObject<number>;
  bottleLift: React.RefObject<number>;
  propsShown: React.RefObject<number>;
}) {
  useFrame((_, delta) => {
    if (reduced) {
      condensation.current = 0.85;
      friesSpread.current = 1;
      bottleLift.current = 0;
      propsShown.current = 1;
      return;
    }
    const dt = Math.min(delta, 1 / 20);

    // The hero shows one bun in a spotlight and nothing else. The fries and the bottle
    // stay out of the world until the build has actually started.
    // Held back until the burger is essentially built. The opening shot is one bun in a
    // spotlight, and the assembly beat stays about the burger; by the time these appear
    // the camera is tight on the stack, so nothing pops into an occupied frame.
    const earlyBeat = scrollState.active === "hero" || scrollState.active === "build";
    propsShown.current = earlyBeat && scrollState.progress.build < 0.88 ? 0 : 1;

    const cold = scrollState.progress.cold;
    const breakdown = scrollState.progress.breakdown;

    // The bottle keeps sweating the longer the beat runs.
    const coldOwns = scrollState.active === "cold" ? 1 : 0.55;
    condensation.current = THREE.MathUtils.damp(
      condensation.current ?? 0,
      clamp01(0.15 + cold * 0.95) * coldOwns + (scrollState.active === "order" ? 0.3 : 0),
      3,
      dt,
    );

    // Fries fan out for their panel and stay open through the close.
    const fanned = smoothstep(0.3, 0.62, breakdown) + (scrollState.active === "order" ? 1 : 0);
    friesSpread.current = THREE.MathUtils.damp(friesSpread.current ?? 0, clamp01(fanned), 3.2, dt);

    // Bottle rises into frame for the cola panel.
    const lift = smoothstep(0.58, 0.86, breakdown) * (scrollState.active === "breakdown" ? 1 : 0);
    bottleLift.current = THREE.MathUtils.damp(bottleLift.current ?? 0, lift, 3, dt);
  });
  return null;
}

/** Keeps renderer colour handling filmic rather than the flat sRGB default. */
function Grade() {
  const { gl } = useThree();
  useEffect(() => {
    const style = getStyle();
    gl.toneMapping =
      style.toneMapping === "linear" ? THREE.LinearToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = style.exposure;
    // Soft shadow edges. The default hard PCF gives a stair-stepped terminator that
    // reads as CG immediately, and the key light here is a large source.
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);
  return null;
}

function Contents({ reduced }: { reduced: boolean }) {
  const q = getQuality();
  const style = getStyle();
  const assembly = useRef(reduced ? 1 : 0);
  const condensation = useRef(reduced ? 0.85 : 0.15);
  const friesSpread = useRef(reduced ? 1 : 0);
  const bottleLift = useRef(0);
  const propsShown = useRef(reduced ? 1 : 0);

  // Orbit is a fine-pointer affordance only. On a touch device a drag on the canvas is
  // indistinguishable from a scroll, and OrbitControls would swallow it — which is the
  // exact scroll trap this build is written to avoid.
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // The final shot hands control to the user; until then the rig owns the camera.
  const [inFinalShot, setInFinalShot] = useState(false);
  useEffect(() => {
    if (reduced) return;
    return onSectionProgress((key, p) => {
      if (key !== "order") return;
      const on = scrollState.active === "order" && p > 0.42;
      setInFinalShot((prev) => (prev === on ? prev : on));
    });
  }, [reduced]);

  const orbit = finePointer && (reduced || inFinalShot);

  // CSS reads this to let pointer events through to the canvas only while orbiting.
  useEffect(() => {
    document.documentElement.dataset.orbit = orbit ? "on" : "off";
  }, [orbit]);

  // Hand the camera over the moment OrbitControls mounts, not on first drag. Both were
  // writing camera.position every frame in between — OrbitControls re-aiming at its own
  // target while the rig re-aimed at the pose's — which knocked the closing shot
  // off-centre. Aim parity (ORBIT_TARGET) makes the handover invisible.
  useEffect(() => {
    scrollState.userControlled = orbit;
    return () => {
      scrollState.userControlled = false;
    };
  }, [orbit]);

  return (
    <>
      <Grade />
      <color attach="background" args={[style.background]} />
      <fog attach="fog" args={[style.background, style.fog[0], style.fog[1]]} />

      <Lighting />

      {reduced ? <StaticCamera /> : <CameraRig reduced={reduced} />}
      <PropDirector
        reduced={reduced}
        condensation={condensation}
        friesSpread={friesSpread}
        bottleLift={bottleLift}
        propsShown={propsShown}
      />

      <Burger reduced={reduced} handles={{ assembly }} />
      <Fries spread={friesSpread} shown={propsShown} />
      <Bottle condensation={condensation} lift={bottleLift} shown={propsShown} />

      {/* Wet, near-black table: invisible as a surface, but it holds the key light's
          specular pool and gives the meal something to sit on. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y - 0.001, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        {style.shading === "toon" ? (
          // Unlit and flat. A lit 60-unit disc under a posteriser reads as concentric
          // contour rings; the flat directions want the ground to be paper, not a surface.
          <meshBasicMaterial color={style.background} />
        ) : (
          <meshStandardMaterial
            color="#0b0706"
            roughness={0.78}
            metalness={style.shading === "chrome" ? 0.4 : 0.06}
            // The table takes only a fraction of the environment: at full strength a
            // 60-unit disc under a bright studio dome becomes a glowing grey floor.
            envMapIntensity={0.3}
          />
        )}
      </mesh>

      {q.shadows && style.shadows && (
        <ContactShadows
          position={[0, GROUND_Y + 0.004, 0]}
          opacity={0.75}
          scale={16}
          blur={2.4}
          far={4}
          resolution={q.tier === "high" ? 1024 : 512}
          color="#000000"
          frames={reduced ? 1 : Infinity}
        />
      )}

      {orbit && (
        <OrbitControls
          makeDefault
          enableZoom={false}
          enablePan={false}
          target={reduced ? STILL_ORBIT_TARGET : ORBIT_TARGET}
          minPolarAngle={0.55}
          maxPolarAngle={1.62}
          rotateSpeed={0.55}
          enableDamping
          dampingFactor={0.06}
          onStart={() => {
            scrollState.userControlled = true;
          }}
        />
      )}

      {!reduced && <Effects />}

      {/* Last, so its first sweep sees every sibling's materials already mounted. */}
      <StyleOverride />
    </>
  );
}

/**
 * One persistent canvas, fixed behind the document. Every DOM section scrolls over it,
 * which is what keeps the page a normal scrolling document — no pinning, no scroll
 * hijacking, no fixed-position wrapper for the browser's keyboard scrolling to fight.
 */
export function Scene({ reduced }: { reduced: boolean }) {
  const q = getQuality();

  return (
    <div className="scene" aria-hidden="true">
      <Canvas
        dpr={q.dpr}
        shadows={q.shadows}
        gl={{ antialias: q.tier !== "low", powerPreference: "high-performance", alpha: false }}
        camera={{ position: [0, 1.75, 5.1], fov: 35, near: 0.1, far: 60 }}
        // Reduced motion means a still frame: render on demand instead of burning a
        // continuous 60fps loop on a scene that isn't moving.
        frameloop={reduced ? "demand" : "always"}
      >
        <Suspense fallback={null}>
          <Contents reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}
