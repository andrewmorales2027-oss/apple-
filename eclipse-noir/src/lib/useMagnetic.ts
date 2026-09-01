import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from './gsap';

/**
 * Magnetic pull for the CTA and the nav links. Pointer-fine only, and off
 * entirely under reduced motion — a control that runs away from the cursor is
 * exactly the kind of motion the setting exists to stop.
 */
export function useMagnetic(
  scope: RefObject<HTMLElement | null>,
  enabled: boolean,
  strength = 0.32,
) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root || !enabled) return;

    const cleanups: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
      const pull = Number(el.dataset.magnetic) || strength;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });

      const onMove = (event: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((event.clientX - r.left - r.width / 2) * pull);
        yTo((event.clientY - r.top - r.height / 2) * pull);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      el.addEventListener('blur', onLeave);
      cleanups.push(() => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
        el.removeEventListener('blur', onLeave);
        gsap.set(el, { x: 0, y: 0 });
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [scope, enabled, strength]);
}
