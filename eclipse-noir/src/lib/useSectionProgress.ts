import { useLayoutEffect, type RefObject } from 'react';
import { ScrollTrigger } from './gsap';
import { setPhaseProgress, type PhaseKey } from './scroll';

/**
 * Publishes a section's 0..1 scroll progress into the shared store.
 *
 * `top center` → `bottom center` means the phases tile without gaps or
 * overlap: the instant one section's centre-line exits, the next begins.
 */
export function useSectionProgress(
  ref: RefObject<HTMLElement | null>,
  key: PhaseKey,
  enabled = true,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top center',
      end: 'bottom center',
      onUpdate: (self) => setPhaseProgress(key, self.progress),
      onLeave: () => setPhaseProgress(key, 1),
      onLeaveBack: () => setPhaseProgress(key, 0),
      onEnter: (self) => setPhaseProgress(key, self.progress),
      onEnterBack: (self) => setPhaseProgress(key, self.progress),
    });

    setPhaseProgress(key, trigger.progress);
    return () => trigger.kill();
  }, [ref, key, enabled]);
}
