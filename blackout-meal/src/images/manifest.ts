/**
 * The photography this site is built around.
 *
 * Every slot below is a real photograph the page expects. To fill one, drop a file named
 * after its id into `src/assets/shots/` — `hero.jpg`, `patty.webp`, and so on. The glob
 * below picks it up automatically; there is no other wiring to do and no import to add.
 *
 * Until a file exists the slot renders a labelled placeholder carrying its own brief, so
 * the layout is always honest about what is missing rather than quietly showing a gap.
 */

const files = import.meta.glob("../assets/shots/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function resolve(id: string): string | null {
  const match = Object.entries(files).find(
    ([path]) => path.split("/").pop()!.replace(/\.[^.]+$/, "") === id,
  );
  return match ? match[1] : null;
}

export interface Shot {
  id: string;
  /** Alt text. Written for a screen reader, not for a search engine. */
  alt: string;
  /** The brief: what this frame has to show, and how it should be lit. */
  brief: string;
  /** Intended aspect ratio, as a CSS aspect-ratio value. */
  ratio: string;
  src: string | null;
}

function shot(id: string, ratio: string, alt: string, brief: string): Shot {
  return { id, ratio, alt, brief, src: resolve(id) };
}

export const SHOTS = {
  hero: shot(
    "hero",
    "16 / 9",
    "The Blackout Meal: a double smash burger, hand-cut fries and a bottle of Brazen Cola on a dark table",
    "Full meal, three-quarter view, shot dark. One hard key from the upper right, deep shadow. Leave the upper third quiet — the wordmark sits there.",
  ),
  section: shot(
    "section",
    "4 / 5",
    "The Blackout Meal burger, cut in half to show its layers",
    "Portrait. The burger halved so the layers read: patty, melt, bacon. Warm light, shallow depth of field.",
  ),
  brioche: shot("brioche", "1 / 1", "A charcoal sesame brioche bun", "The crown alone. Sesame catching a raking light."),
  patty: shot("patty", "1 / 1", "A smash patty searing on a flat-top griddle", "On the griddle mid-sear. Crust, steam, motion."),
  cheese: shot("cheese", "1 / 1", "Aged cheddar melting over a hot patty", "The melt caught running over the edge. The money shot."),
  bacon: shot("bacon", "1 / 1", "Thick-cut hickory bacon straight off the grill", "Straight off the grill, still glossy."),
  stack: shot("stack", "1 / 1", "The finished burger, assembled", "The finished burger, straight on, hero-lit."),
  fries: shot(
    "fries",
    "3 / 2",
    "Hand-cut fries with flaky salt",
    "Landscape, filling the frame. Salt visible. Hot, not styled to death.",
  ),
  cola: shot(
    "cola",
    "3 / 2",
    "A glass bottle of Brazen Cola, ice cold and beaded with condensation",
    "Landscape. Backlit so the cola glows through the glass; condensation sharp.",
  ),
  order: shot(
    "order",
    "16 / 9",
    "The full Blackout Meal laid out on a table",
    "The whole combo, overhead or low three-quarter, on a dark table. Warm and generous.",
  ),
} satisfies Record<string, Shot>;

export type ShotId = keyof typeof SHOTS;

/** The ingredient sequence the build section steps through. */
export const BUILD_STEPS: { shot: ShotId; name: string; note: string }[] = [
  { shot: "brioche", name: "Charcoal brioche", note: "Black sesame crown, toasted on the flat top." },
  { shot: "patty", name: "Double smash patty", note: "Two 4oz, pressed thin so the whole face crusts." },
  { shot: "cheese", name: "Aged cheddar", note: "Laid on hot and left to run over the edge." },
  { shot: "bacon", name: "Hickory bacon", note: "Thick cut, straight off the grill, still glossy." },
  { shot: "stack", name: "Stacked right", note: "Pickle, onion, tomato, house sauce. Closed and cut." },
];

/** True once at least one real photograph has been dropped in. */
export const HAS_PHOTOGRAPHY = Object.values(SHOTS).some((s) => s.src !== null);
