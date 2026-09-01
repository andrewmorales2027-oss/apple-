import { useEffect, useRef } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Opens a photograph like a shutter: the frame's mask retracts as it enters view,
 * driven by scroll position rather than a fixed timeline, so the reveal tracks the
 * reader instead of firing at them.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia(REDUCED).matches) {
      el.style.setProperty("--reveal", "1");
      return;
    }

    let pending = false;
    const update = () => {
      pending = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Fully open by the time the frame's top third has cleared the fold.
      const progress = (vh - rect.top) / (vh * 0.55);
      el.style.setProperty("--reveal", String(Math.min(1, Math.max(0, progress))));
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return ref;
}

/** One-shot rise for copy blocks. Fires once and stops observing. */
export function useRise<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia(REDUCED).matches) {
      el.dataset.shown = "true";
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.shown = "true";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
