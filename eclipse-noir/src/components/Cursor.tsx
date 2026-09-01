import { useEffect, useRef } from 'react';
import { gsap } from '../lib/gsap';

const INTERACTIVE = 'a, button, [data-magnetic], [data-cursor="grow"]';

/**
 * Dot plus a lagging ring. Desktop only — gated on `(pointer: fine)` by the
 * caller, because a custom cursor on a touch device is just a bug.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dotEl = dot.current;
    const ringEl = ring.current;
    if (!dotEl || !ringEl) return;

    document.body.classList.add('cursor-custom');
    gsap.set([dotEl, ringEl], { x: window.innerWidth / 2, y: window.innerHeight / 2 });

    const dotX = gsap.quickTo(dotEl, 'x', { duration: 0.09, ease: 'power3.out' });
    const dotY = gsap.quickTo(dotEl, 'y', { duration: 0.09, ease: 'power3.out' });
    const ringX = gsap.quickTo(ringEl, 'x', { duration: 0.55, ease: 'power3.out' });
    const ringY = gsap.quickTo(ringEl, 'y', { duration: 0.55, ease: 'power3.out' });

    const onMove = (event: PointerEvent) => {
      dotX(event.clientX);
      dotY(event.clientY);
      ringX(event.clientX);
      ringY(event.clientY);
    };

    const onOver = (event: PointerEvent) => {
      const target = event.target as Element | null;
      ringEl.dataset.active = String(Boolean(target?.closest?.(INTERACTIVE)));
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      document.body.classList.remove('cursor-custom');
    };
  }, []);

  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden="true" />
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
