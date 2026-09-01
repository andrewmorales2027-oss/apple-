import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "../lib/reducedMotion";

gsap.registerPlugin(ScrollTrigger);

export type SectionKey = "hero" | "build" | "cold" | "breakdown" | "order";

/**
 * The single mutable bridge between the DOM scroll position and the WebGL frame loop.
 *
 * ScrollTrigger writes into it on scroll; useFrame reads it and damps toward it. Nothing
 * here ever triggers a React render — a re-render per scroll frame is what makes these
 * pages stutter.
 */
export const scrollState = {
  /** 0 -> 1 through each section's own scroll range. */
  progress: { hero: 0, build: 0, cold: 0, breakdown: 0, order: 0 } as Record<SectionKey, number>,
  /** The section currently owning the camera. */
  active: "hero" as SectionKey,
  /** True once the user has taken the final shot over with OrbitControls. */
  userControlled: false,
};

/** Subscribers for the few places that genuinely need React state (e.g. the ingredient list). */
type Listener = (key: SectionKey, progress: number) => void;
const listeners = new Set<Listener>();

export function onSectionProgress(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Registers a section's scroll range.
 *
 * Note: this deliberately does NOT use ScrollTrigger's `pin`. Pinning rewrites the
 * document with a fixed-position wrapper, which breaks native keyboard scrolling and
 * fights the browser's own scroll anchoring. The visual "pin" comes from CSS
 * `position: sticky` in the stylesheet instead, so Space / PageDown / Home / End and
 * screen-reader virtual cursors keep working exactly as they do on a plain page.
 */
export function useSectionScroll(ref: RefObject<HTMLElement | null>, key: SectionKey) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    // The hero is exactly one viewport tall, so it has no sticky travel of its own and
    // is measured across its exit instead. Every other section is measured across the
    // span its sticky panel is actually held on screen, which is the only mapping where
    // "the copy is centred" and "the beat is halfway" mean the same thing.
    const range =
      key === "hero"
        ? { start: "top top", end: "bottom top" }
        : { start: "top top", end: "bottom bottom" };

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: range.start,
      end: range.end,
      onUpdate: (self) => {
        scrollState.progress[key] = self.progress;
        listeners.forEach((fn) => fn(key, self.progress));
      },
      onToggle: (self) => {
        if (self.isActive) return;
        // Clamp to the end we left through so a fast scroll never strands a value mid-range.
        const settled = self.direction === 1 ? 1 : 0;
        scrollState.progress[key] = settled;
        listeners.forEach((fn) => fn(key, settled));
      },
    });

    // A second, tighter trigger decides who owns the camera: the section covering the
    // middle of the viewport.
    const owner = ScrollTrigger.create({
      trigger: el,
      start: "top center",
      end: "bottom center",
      onToggle: (self) => {
        if (self.isActive) {
          scrollState.active = key;
          if (key !== "order") scrollState.userControlled = false;
        }
      },
    });

    return () => {
      trigger.kill();
      owner.kill();
    };
  }, [ref, key]);
}

/**
 * Section-local progress remapped to 0..1 over an inner window of the section's range.
 * Sections are taller than the viewport, so the interesting beat rarely spans the whole
 * scroll range.
 */
export function window01(p: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (p - start) / (end - start)));
}
