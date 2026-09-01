import * as THREE from "three";

/**
 * Where everything sits on the table. The camera rig, the props and the ground plane all
 * read from here so a nudge to one prop can't quietly desync the shot that frames it.
 */
export const GROUND_Y = -1.12;

export const BURGER_CENTER = new THREE.Vector3(0, 0.05, 0);
export const BOTTLE_POS = new THREE.Vector3(5.0, GROUND_Y, -0.55);
export const FRIES_POS = new THREE.Vector3(-3.0, GROUND_Y, -0.35);

/** Mid-height of the bottle, for aiming the glass beat. */
export const BOTTLE_CENTER = new THREE.Vector3(BOTTLE_POS.x, GROUND_Y + 1.45, BOTTLE_POS.z);
