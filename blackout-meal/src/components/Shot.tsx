import { useEffect, useRef, type CSSProperties } from "react";
import { SHOTS, type ShotId } from "../images/manifest";

/**
 * A photograph, or an honest stand-in for one.
 *
 * Where a file exists the image is rendered with a slow parallax drift inside its own
 * frame — the only motion photography needs, and the thing that keeps a still page from
 * feeling like a PDF. Where no file exists yet the slot renders its own brief, so a gap
 * in the shoot reads as "this frame is waiting for a picture of X" rather than as a
 * broken layout.
 */
export function Shot({
  id,
  className,
  parallax = 0.12,
  sizes,
  priority = false,
}: {
  id: ShotId;
  className?: string;
  /** Fraction of the frame height the image drifts across a full pass. 0 disables. */
  parallax?: number;
  sizes?: string;
  priority?: boolean;
}) {
  const shot = SHOTS[id];
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = frame.current;
    const picture = img.current;
    if (!el || !picture || parallax <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let pending = false;

    const update = () => {
      pending = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return;
      // -0.5 .. 0.5 as the frame crosses the viewport.
      const travel = (rect.top + rect.height / 2 - vh / 2) / (vh + rect.height);
      picture.style.transform = `translate3d(0, ${(travel * parallax * 100).toFixed(3)}%, 0)`;
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [parallax]);

  const style = { "--ratio": shot.ratio } as CSSProperties;

  return (
    <div className={`shot ${className ?? ""}`} ref={frame} style={style} data-active={className?.includes("is-active") || undefined}>
      {shot.src ? (
        <img
          ref={img}
          className="shot__img"
          src={shot.src}
          alt={shot.alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          // Overscanned so the parallax drift never exposes an edge.
          style={{ height: `${100 + parallax * 100}%` }}
        />
      ) : (
        <div className="shot__await" role="img" aria-label={shot.alt}>
          <span className="shot__slot">{shot.id}.jpg</span>
          <p className="shot__brief">{shot.brief}</p>
        </div>
      )}
    </div>
  );
}
