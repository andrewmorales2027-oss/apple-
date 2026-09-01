import { bell, easeInOutSine, lerp, smoothstep, HALF_PI, TAU } from '../lib/math';
import type { PhaseKey } from '../lib/scroll';

/**
 * The camera choreography, as one pure function of (phase, progress).
 *
 * Geometry contract for the eclipse — this is the whole point of section 2, so
 * it is blocked out deliberately rather than left to an orbit path:
 *
 *   - the black cylinder is r = 1.00, half-height 0.275, centred on the origin
 *   - the gold cap is r = 0.40, offset to x = +0.30, spanning y 0.275 → 0.345
 *   - at totality p = 0.5 the camera sits at azimuth PI, i.e. straight down the
 *     -X axis at (-4.25, -0.07, 0)
 *
 * From there the sight-line that grazes the cylinder's near top rim (-1, 0.275)
 * passes *above* every point of the cap: at x = -1 the ray to the cap's nearest
 * top corner (-0.10, 0.345) is at y = 0.255, a comfortable 0.02 below the rim.
 * The gold disc is therefore fully occluded by the body of the bottle — a real
 * eclipse by real geometry, not a fade.
 *
 * Azimuth travels exactly TAU across the directed sequence, so the page ends
 * where it began and OrbitControls inherits a front-on hero pose.
 */

export type Pose = {
  /** Orbit angle. position = (r·cos az, y, r·sin az); az = PI/2 is dead front. */
  az: number;
  y: number;
  r: number;
  /** Lateral aim offset in camera-right units. Positive pushes the bottle left. */
  lateral: number;
  /** Vertical aim offset in camera-up units. Negative lifts the bottle in frame. */
  vertical: number;
  /** Camera roll in radians. A couple of degrees of "wrong" at totality. */
  roll: number;
  /** 0..1 how eclipsed we are. Drives the light collapse. */
  eclipse: number;
  /** 0..1 cool ozone → warm amber, driven by the notes section. */
  warm: number;
};

const AZ_HERO = HALF_PI;
const AZ_TOTALITY_END = HALF_PI + Math.PI;
const AZ_CORONA_END = HALF_PI + Math.PI * 1.82;
const AZ_NOTES_END = HALF_PI + Math.PI * 1.94;
const AZ_PRODUCT_END = HALF_PI + TAU;

export function poseFor(phase: PhaseKey, p: number, wide: boolean): Pose {
  const pose: Pose = {
    az: AZ_HERO,
    y: 0.34,
    r: 5.0,
    lateral: 0,
    vertical: 0,
    roll: 0,
    eclipse: 0,
    warm: 0,
  };

  switch (phase) {
    // 1. First contact — barely moves. The bottle should read as still.
    // Framed high and right so the wordmark owns the lower-left of the plate;
    // on narrow screens it just sits above the copy instead.
    case 'hero': {
      const e = smoothstep(0.4, 1, p);
      pose.az = AZ_HERO;
      pose.y = lerp(0.5, 0.4, e);
      pose.r = lerp(6.6, 6.1, e);
      pose.lateral = wide ? -1.5 : 0;
      pose.vertical = wide ? -0.5 : -0.85;
      break;
    }

    // 2. Totality — a half-orbit with the eclipse landing exactly on p = 0.5.
    // easeInOutSine is symmetric, so easing the arc doesn't move that beat.
    case 'totality': {
      const e = easeInOutSine(p);
      const b = bell(p);
      pose.az = lerp(AZ_HERO, AZ_TOTALITY_END, e);
      pose.y = lerp(0.34, 0.52, e) - 0.5 * b;
      pose.r = 5.0 - 0.75 * b;
      pose.roll = 0.055 * b;
      pose.eclipse = b;
      // Slides back to centre as the eclipse approaches: by p = 0.5 the bottle
      // owns the middle of the frame and the copy has faded down around it.
      pose.lateral = lerp(wide ? -1.5 : 0, 0, smoothstep(0, 0.4, p));
      // Stays lifted: eclipse photography puts the corona high in the plate
      // and leaves the bottom third for the caption.
      pose.vertical = lerp(wide ? -0.5 : -0.85, -0.46, smoothstep(0, 0.4, p));
      break;
    }

    // 3. The corona — the camera lifts and drifts while the glass ring turns.
    // Bottle slides left of frame so the copy has clean space on the right.
    case 'corona': {
      const e = easeInOutSine(p);
      pose.az = lerp(AZ_TOTALITY_END, AZ_CORONA_END, e);
      pose.y = lerp(0.52, 0.78, e);
      pose.r = lerp(5.0, 5.4, e);
      pose.lateral = wide ? lerp(0, 1.15, smoothstep(0, 0.45, p)) : 0;
      pose.vertical = lerp(-0.46, wide ? -0.1 : -0.95, smoothstep(0, 0.45, p));
      break;
    }

    // 4. Notes — a slow settle while the light walks from ozone to amber.
    // Bottle crosses to the right; the note panels own the left column.
    case 'notes': {
      const e = easeInOutSine(p);
      pose.az = lerp(AZ_CORONA_END, AZ_NOTES_END, e);
      pose.y = lerp(0.78, 0.22, e);
      pose.r = lerp(5.4, 4.7, e);
      pose.lateral = wide ? lerp(1.15, -1.2, smoothstep(0.02, 0.4, p)) : 0;
      pose.vertical = wide ? 0 : -0.95;
      pose.warm = p;
      break;
    }

    // 5. Own the dark — recentre, front-on, then hand the camera over.
    // Settles by p ≈ 0.62: the page runs out of scroll before this section's
    // centre-line trigger completes, so the pose has to land early.
    case 'product': {
      const e = easeInOutSine(Math.min(1, p / 0.62));
      pose.az = lerp(AZ_NOTES_END, AZ_PRODUCT_END, e);
      pose.y = lerp(0.22, 0.3, e);
      pose.r = lerp(4.7, 5.15, e);
      pose.lateral = wide ? lerp(-1.2, 0, smoothstep(0, 0.5, p)) : 0;
      // Lifts clear of the headline: OrbitControls inherits this exact framing
      // via ORBIT_TARGET, so the handover doesn't snap the bottle back to centre.
      pose.vertical = lerp(wide ? 0 : -0.95, wide ? -0.9 : -1.05, smoothstep(0, 0.5, p));
      pose.warm = 1;
      break;
    }
  }

  return pose;
}

/**
 * Where the camera orbits once the directed sequence is over. It sits *below*
 * the bottle by the same amount the final pose aims below it, which is what
 * keeps the product high in the plate while the visitor spins it.
 */
export const ORBIT_TARGET: [number, number, number] = [0, -0.88, 0];

/** Static pose used when the visitor has asked for reduced motion. */
export const STILL_POSE: Pose = {
  az: HALF_PI + 0.42,
  y: 0.46,
  r: 5.1,
  lateral: 0,
  vertical: -0.2,
  roll: 0,
  eclipse: 0,
  warm: 0.35,
};

/**
 * The gold rim flare. Rises as the key light dies, peaks just past totality,
 * then burns off as the camera carries on around.
 */
export function coronaFlare(phase: PhaseKey, p: number) {
  if (phase !== 'totality') return 0;
  return smoothstep(0.32, 0.5, p) * (1 - smoothstep(0.63, 0.92, p));
}
