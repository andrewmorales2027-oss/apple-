import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { scrollState, type SectionKey } from "./scrollState";
import { clamp01, easeInOutCubic, smoothstep } from "./easing";
import { BOTTLE_CENTER, BURGER_CENTER, FRIES_POS } from "./layout";
import { focusTarget } from "./focus";

/**
 * A narrow viewport sees far less horizontally at the same distance, so every pose gets
 * pushed back on portrait phones. Without this the breakdown shot crops the fries and the
 * bottle straight off the sides.
 */
function fitScale(aspect: number) {
  return aspect >= 1.35 ? 1 : 1 + (1.35 - Math.max(aspect, 0.4)) * 0.62;
}

function orbit(center: THREE.Vector3, angle: number, radius: number, height: number, out: THREE.Vector3) {
  return out.set(
    center.x + Math.sin(angle) * radius,
    center.y + height,
    center.z + Math.cos(angle) * radius,
  );
}

/**
 * Fills the camera pose for a section, plus the position of that beat's actual subject.
 *
 * These are deliberately two different points. The aim point is a composition decision —
 * the cold beat aims well to the right of the bottle so the glass sits in the left third
 * and the copy gets the rest of the frame. The subject is where the thing being sold
 * actually is. Focus follows the subject; if it followed the aim point, the hero product
 * would be the one object out of focus in its own shot.
 */
function poseFor(
  section: SectionKey,
  p: number,
  k: number,
  pos: THREE.Vector3,
  look: THREE.Vector3,
  subject: THREE.Vector3,
) {
  switch (section) {
    case "hero": {
      // Held on the lone crown, and aimed above it so the wordmark owns the upper half
      // of the frame. Barely moves — the withholding is the point.
      pos.set(0.1, 2.0 + p * 0.18, (5.5 - p * 0.35) * k);
      look.set(0, 2.05, 0);
      subject.set(0, 1.45, 0);
      break;
    }
    case "build": {
      // Crane down and orbit a third of the way around as the stack goes up.
      const e = easeInOutCubic(p);
      orbit(BURGER_CENTER, -0.52 + e * 1.12, (7.6 - e * 1.5) * k, 3.0 - e * 1.85, pos);
      look.set(0, 0.7 - e * 0.55, 0);
      subject.copy(BURGER_CENTER);
      break;
    }
    case "cold": {
      // Cut to the bottle, close enough to crop it. Aimed to its right so the glass sits
      // in the left third and the copy beside it never has to fight it for the frame.
      const e = easeInOutCubic(p);
      orbit(BOTTLE_CENTER, -0.62 + e * 0.8, (5.3 - e * 0.7) * k, -0.15 + e * 0.4, pos);
      look.set(BOTTLE_CENTER.x + 1.85, 0.25 + e * 0.2, BOTTLE_CENTER.z);
      subject.copy(BOTTLE_CENTER);
      break;
    }
    case "breakdown": {
      // Pull back to hold all three, reframing gently toward whichever panel is up.
      const toFries = smoothstep(0.28, 0.5, p) * (1 - smoothstep(0.58, 0.8, p));
      const toCola = smoothstep(0.58, 0.8, p);
      const focus = -1.15 * toFries + 2.5 * toCola;
      pos.set(focus * 0.45, 1.35, (9.2 - p * 0.5) * k);
      look.set(focus, -0.1, 0);
      // Focus racks between the three components as their panels come up.
      subject
        .copy(BURGER_CENTER)
        .lerp(FRIES_POS, toFries)
        .lerp(BOTTLE_CENTER, toCola);
      break;
    }
    case "order": {
      // Final hero shot, aimed low so the meal sits above the closing copy.
      const e = easeInOutCubic(clamp01(p * 1.4));
      orbit(BURGER_CENTER, 0.3 - e * 0.3, (7.4 - e * 0.6) * k, 1.5 - e * 0.35, pos);
      // Must match ORBIT_TARGET in Scene.tsx: when OrbitControls takes over it re-aims at
      // its own target, and any difference from the rig's aim shows up as a jump.
      look.set(0, -0.45, 0);
      subject.copy(BURGER_CENTER);
      break;
    }
  }
}

/**
 * Drives the camera off scroll. Nothing here teleports: the pose is recomputed every
 * frame from the (already damped) scroll value and the camera is damped toward it, so a
 * flung scroll or a jump-to-anchor arrives as a move rather than a cut.
 */
export function CameraRig({ reduced }: { reduced: boolean }) {
  const { size } = useThree();
  const scratch = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      subject: new THREE.Vector3().copy(BURGER_CENTER),
      current: new THREE.Vector3(0, 2.0, 5.5),
      target: new THREE.Vector3(0, 2.05, 0),
    }),
    [],
  );

  useFrame(({ camera }, delta) => {
    if (reduced || scrollState.userControlled) return;

    const k = fitScale(size.width / size.height);
    const section = scrollState.active;
    poseFor(section, scrollState.progress[section], k, scratch.pos, scratch.look, scratch.subject);

    const dt = Math.min(delta, 1 / 20);
    // Slightly quicker on the look target than the position: the camera settles its aim
    // first and then arrives, which is how a real crane move reads.
    scratch.current.copy(camera.position);
    camera.position.set(
      THREE.MathUtils.damp(scratch.current.x, scratch.pos.x, 2.6, dt),
      THREE.MathUtils.damp(scratch.current.y, scratch.pos.y, 2.6, dt),
      THREE.MathUtils.damp(scratch.current.z, scratch.pos.z, 2.6, dt),
    );
    scratch.target.set(
      THREE.MathUtils.damp(scratch.target.x, scratch.look.x, 3.4, dt),
      THREE.MathUtils.damp(scratch.target.y, scratch.look.y, 3.4, dt),
      THREE.MathUtils.damp(scratch.target.z, scratch.look.z, 3.4, dt),
    );
    camera.lookAt(scratch.target);

    // Rack focus toward the new subject rather than cutting to it — a hard focus jump
    // between sections reads as a glitch, a rack reads as a camera operator.
    focusTarget.set(
      THREE.MathUtils.damp(focusTarget.x, scratch.subject.x, 2.2, dt),
      THREE.MathUtils.damp(focusTarget.y, scratch.subject.y, 2.2, dt),
      THREE.MathUtils.damp(focusTarget.z, scratch.subject.z, 2.2, dt),
    );
  });

  return null;
}

/**
 * Static framing used when the user asks for reduced motion: one wide three-quarter shot
 * holding all three components, aimed high so the meal sits below the copy instead of
 * behind it. This is the whole page's photography, so it has to work as a single image.
 */
export function StaticCamera() {
  const { camera, size } = useThree();
  useMemo(() => {
    const k = fitScale(size.width / size.height);
    camera.position.set(1.5 * k, 3.6, 9.8 * k);
    // Aimed above the meal so it sits in the lower half, clear of the copy. Must match
    // STILL_ORBIT_TARGET in Scene.tsx — OrbitControls is mounted in this path and will
    // re-aim the camera at its own target on the first frame.
    camera.lookAt(0.9, 2.2, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}
