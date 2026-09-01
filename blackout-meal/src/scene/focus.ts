import * as THREE from "three";
import { BURGER_CENTER } from "./layout";

/**
 * The point the camera is currently aimed at, in world space.
 *
 * Depth of field reads this as its auto-focus target. A fixed focal plane would be wrong
 * the moment the camera leaves the burger for the bottle — the subject of the shot would
 * be the one thing out of focus. The rig writes its damped look target here every frame,
 * so focus follows the composition rather than a hardcoded distance.
 */
export const focusTarget = new THREE.Vector3().copy(BURGER_CENTER);
