import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Backdrop } from './Backdrop';
import { Bottle } from './Bottle';
import { CoronaGlow } from './CoronaGlow';
import { CoronaRing } from './CoronaRing';
import { coronaFlare, ORBIT_TARGET, poseFor, STILL_POSE, type Pose } from './choreography';
import { damp, lerp } from '../lib/math';
import { scrollState } from '../lib/scroll';

const TARGET = new THREE.Vector3(0, 0.05, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Cool is a *tint*, not a colour wash. The ground here is near-black; the
// ozone/amber walk through the notes section has to read without the page ever
// turning navy or orange.
const COOL = new THREE.Color('#b9cbe6'); // ozone, top notes
const WARM = new THREE.Color('#e0b478'); // amber resin, base notes
const SKY_COOL = new THREE.Color('#0f1b30');
const SKY_WARM = new THREE.Color('#2b1c0d');
const GOLD = new THREE.Color('#c8a04a');
const NEUTRAL = new THREE.Color('#ffffff');

const KEY_INTENSITY = 30;
const FILL_INTENSITY = 1.6;
const CORONA_INTENSITY = 14;

type StageProps = {
  reduced: boolean;
  quality: 'high' | 'low';
  showRing: boolean;
  orbit: boolean;
};

export function Stage({ reduced, quality, showRing, orbit }: StageProps) {
  const key = useRef<THREE.SpotLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const corona = useRef<THREE.PointLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const glow = useRef<THREE.ShaderMaterial>(null);
  const sky = useRef<THREE.ShaderMaterial>(null);

  return (
    <>
      <color attach="background" args={['#07080b']} />
      <Backdrop ref={sky} />

      <ambientLight ref={ambient} intensity={0.1} color={COOL} />

      {/* One hard rim light — the moment just before totality. Kept at a fixed
          angle *relative to the camera* so a full revolution never leaves the
          bottle unlit by accident; the drama comes from intensity, not luck. */}
      <spotLight
        ref={key}
        intensity={KEY_INTENSITY}
        angle={0.62}
        penumbra={0.85}
        distance={22}
        decay={1.4}
        color="#dfe6f5"
      />
      <directionalLight ref={fill} intensity={FILL_INTENSITY} color={COOL} />

      {/* The corona: a gold source directly behind the bottle from wherever the
          camera happens to be, so the rim it draws always hugs the silhouette. */}
      <pointLight ref={corona} intensity={0} distance={26} decay={1.5} color={GOLD} />

      <Bottle />
      <CoronaGlow ref={glow} />
      {showRing && <CoronaRing quality={quality} animated={!reduced} />}

      {/* Procedural environment — no HDR download. Gives metalness:1 something
          real to reflect, which is the difference between gold and grey. */}
      <Environment resolution={quality === 'high' ? 128 : 64} frames={1}>
        <color attach="background" args={['#05060a']} />
        <Lightformer form="rect" intensity={1.8} color="#dfe4ee" scale={[10, 10, 1]} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={6} color="#ffffff" scale={[0.35, 8, 1]} position={[-5, 1, 2]} rotation={[0, -Math.PI / 2, 0]} />
        <Lightformer form="rect" intensity={2.2} color="#c8a04a" scale={[5, 2, 1]} position={[4, -1, -3]} rotation={[0, Math.PI / 3, 0]} />
        <Lightformer form="ring" intensity={0.7} color="#9fb6d8" scale={3.5} position={[3, 3, 4]} />
      </Environment>

      <Choreographer
        reduced={reduced}
        orbit={orbit}
        refs={{ key, fill, corona, ambient, glow, sky }}
      />

      {orbit && (
        <OrbitControls
          makeDefault
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.5}
          target={ORBIT_TARGET}
          minPolarAngle={Math.PI * 0.3}
          maxPolarAngle={Math.PI * 0.58}
        />
      )}
    </>
  );
}

type Refs = {
  key: RefObject<THREE.SpotLight | null>;
  fill: RefObject<THREE.DirectionalLight | null>;
  corona: RefObject<THREE.PointLight | null>;
  ambient: RefObject<THREE.AmbientLight | null>;
  glow: RefObject<THREE.ShaderMaterial | null>;
  sky: RefObject<THREE.ShaderMaterial | null>;
};

/**
 * Single frame loop for the whole experience. Scroll progress comes in through
 * a plain mutable object (never React state) and every value below is damped
 * toward its target rather than snapped, so fast scrolling reads as a camera
 * with mass instead of a slideshow.
 */
function Choreographer({
  reduced,
  orbit,
  refs,
}: {
  reduced: boolean;
  orbit: boolean;
  refs: Refs;
}) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  const aspect = width / Math.max(height, 1);
  const fit = aspect >= 1 ? 1 : Math.pow(1 / Math.max(aspect, 0.42), 0.9);

  // Damped state, kept as scalars so the orbit never cuts across the bottle.
  const cur = useRef<Pose>({ ...STILL_POSE });
  const flare = useRef(0);
  const scratch = useRef({
    pos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    aim: new THREE.Vector3(),
    color: new THREE.Color(),
  });

  const applyLights = (pose: Pose, flareAmount: number) => {
    const { key, fill, corona, ambient, glow, sky } = refs;
    const { pos, dir, color } = scratch.current;

    // "Exposure": the eclipse is a light failure, so dim the actual sources and
    // the environment contribution rather than post-processing the picture.
    const dim = lerp(1, 0.08, pose.eclipse);
    const warmth = pose.warm;

    color.copy(COOL).lerp(WARM, warmth);

    if (ambient.current) {
      ambient.current.intensity = lerp(0.1, 0.085, warmth) * lerp(1, 0.12, pose.eclipse);
      ambient.current.color.copy(color);
    }

    if (key.current) {
      const az = pose.az + 2.2;
      key.current.position.set(Math.cos(az) * 6.4, 3.4, Math.sin(az) * 6.4);
      key.current.target.position.copy(TARGET);
      key.current.target.updateMatrixWorld();
      key.current.intensity = KEY_INTENSITY * dim * lerp(1, 0.8, warmth);
      key.current.color.copy(color).lerp(NEUTRAL, 0.4);
    }

    if (fill.current) {
      const az = pose.az - 1.95;
      fill.current.position.set(Math.cos(az) * 5.5, 0.8, Math.sin(az) * 5.5);
      fill.current.intensity = FILL_INTENSITY * dim;
      fill.current.color.copy(color);
    }

    if (corona.current) {
      // Always directly opposite the camera, so the rim it paints tracks the
      // silhouette through the whole orbit.
      pos.set(Math.cos(pose.az) * pose.r, pose.y, Math.sin(pose.az) * pose.r);
      dir.copy(pos).sub(TARGET).normalize();
      corona.current.position.copy(TARGET).addScaledVector(dir, -4.2);
      corona.current.position.y = 0.3;
      corona.current.intensity = CORONA_INTENSITY * flareAmount;
    }

    if (glow.current) {
      glow.current.uniforms.uOpacity.value = flareAmount;
    }

    if (sky.current) {
      sky.current.uniforms.uBrightness.value = lerp(1, 0.02, pose.eclipse);
      (sky.current.uniforms.uTint.value as THREE.Color).copy(SKY_COOL).lerp(SKY_WARM, warmth);
    }

    scene.environmentIntensity = lerp(0.62, 0.04, pose.eclipse);
  };

  const applyCamera = (pose: Pose, fit: number) => {
    const { pos, dir, right, up, aim } = scratch.current;

    // The camera has a vertical FOV, so a phone in portrait would otherwise
    // crop the bottle horizontally. Pulling back by the aspect deficit — and
    // scaling the aim offsets by the same factor — keeps every shot framed the
    // way it was blocked out, on any viewport.
    const r = pose.r * fit;
    pos.set(Math.cos(pose.az) * r, pose.y * fit, Math.sin(pose.az) * r);
    camera.position.copy(pos);

    // Aim off the bottle rather than moving the bottle: shifting the look-at
    // point in camera-space slides the product around the plate while the
    // orbit stays a clean circle. Negative `vertical` lifts it in frame.
    dir.copy(TARGET).sub(pos).normalize();
    right.crossVectors(dir, WORLD_UP).normalize();
    up.crossVectors(right, dir).normalize();
    aim
      .copy(TARGET)
      .addScaledVector(right, pose.lateral * fit)
      .addScaledVector(up, pose.vertical * fit);

    camera.lookAt(aim);
    if (pose.roll !== 0) camera.rotateZ(pose.roll);
  };

  // Static path: set the scene once, then never touch it again.
  useLayoutEffect(() => {
    if (!reduced) return;
    Object.assign(cur.current, STILL_POSE);
    applyCamera(STILL_POSE, fit);
    applyLights(STILL_POSE, 0.22);
    invalidate();
    const t = window.setTimeout(invalidate, 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, invalidate, fit]);

  useFrame((_, delta) => {
    if (reduced) return;

    const wide = width >= 900;
    const phase = scrollState.active;
    const target = poseFor(phase, scrollState.activeP, wide);
    const targetFlare = coronaFlare(phase, scrollState.activeP);

    const c = cur.current;
    c.az = damp(c.az, target.az, 3.4, delta);
    c.y = damp(c.y, target.y, 3.4, delta);
    c.r = damp(c.r, target.r, 3.4, delta);
    c.lateral = damp(c.lateral, target.lateral, 3.0, delta);
    c.vertical = damp(c.vertical, target.vertical, 3.0, delta);
    c.roll = damp(c.roll, target.roll, 3.4, delta);
    // Light reacts a touch faster than the camera — the sky goes first.
    c.eclipse = damp(c.eclipse, target.eclipse, 6.0, delta);
    c.warm = damp(c.warm, target.warm, 2.4, delta);
    flare.current = damp(flare.current, targetFlare, 5.0, delta);

    if (!orbit) applyCamera(c, fit);
    applyLights(c, flare.current);
  });

  return null;
}
