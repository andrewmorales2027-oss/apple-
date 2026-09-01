import { useEffect } from "react";
import gsap from "gsap";

/**
 * Dot plus a ring that lags behind it, and a magnetic pull on anything marked
 * [data-magnetic]. Desktop only — a custom cursor on a touch device is just a stray dot
 * that never moves, so the whole thing is gated on a fine pointer and never mounts
 * otherwise.
 */
export function Cursor() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cursor";
    ring.className = "cursor-ring";
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.append(dot, ring);
    document.documentElement.classList.add("has-custom-cursor");

    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 });

    const onMove = (e: PointerEvent) => {
      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0.08, ease: "power2.out" });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.42, ease: "power3.out" });
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    // Magnetic targets pull the ring open and drag themselves toward the pointer.
    const magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnetic]"));
    const cleanups: Array<() => void> = [];

    for (const el of magnets) {
      const strength = Number(el.dataset.magnetic) || 0.32;

      const enter = () => gsap.to(ring, { scale: 1.9, opacity: 0.45, duration: 0.3, ease: "power2.out" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - r.left - r.width / 2) * strength,
          y: (e.clientY - r.top - r.height / 2) * strength,
          duration: 0.35,
          ease: "power3.out",
        });
      };
      const leave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.45)" });
        gsap.to(ring, { scale: 1, opacity: 1, duration: 0.35, ease: "power2.out" });
      };

      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
        gsap.set(el, { x: 0, y: 0 });
      });
    }

    return () => {
      window.removeEventListener("pointermove", onMove);
      cleanups.forEach((fn) => fn());
      document.documentElement.classList.remove("has-custom-cursor");
      dot.remove();
      ring.remove();
    };
  }, []);

  return null;
}
