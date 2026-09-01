import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from '../lib/gsap';
import { useSectionProgress } from '../lib/useSectionProgress';
import { useInView } from '../lib/useInView';

/**
 * 3. The Corona — the page's single glass moment.
 *
 * The refractive ring itself lives in the 3D scene; this section owns the copy
 * beside it and tells the scene when to mount the expensive material.
 */
export function Corona({
  reduced,
  onNearChange,
}: {
  reduced: boolean;
  onNearChange: (near: boolean) => void;
}) {
  const section = useRef<HTMLElement>(null);
  const ref = section as RefObject<HTMLElement | null>;

  useSectionProgress(ref, 'corona');

  // Mount the transmission material only when the section is within roughly
  // half a viewport, and drop it again once it's gone.
  const near = useInView(ref, { rootMargin: '60% 0px 60% 0px' });
  useLayoutEffect(() => onNearChange(near), [near, onNearChange]);

  useLayoutEffect(() => {
    if (reduced) return;
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', {
        opacity: 0,
        y: 30,
        filter: 'blur(12px)',
        duration: 1.3,
        ease: 'power3.out',
        stagger: 0.14,
        scrollTrigger: { trigger: el, start: 'top 58%', once: true },
      });
    }, el);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={section} className="section corona" id="corona" aria-labelledby="corona-heading">
      <div className="corona__copy">
        <p className="eyebrow eyebrow--gold" data-reveal>
          The corona
        </p>
        <h2 className="corona__line" id="corona-heading" data-reveal>
          Ninety seconds of <em>wrong light.</em>
        </h2>
        <p className="lede" data-reveal>
          Not darkness — light with the warmth taken out of it. A thin ring of it survives
          around the edge, and that ring is the only gold in the whole composition.
        </p>
      </div>
    </section>
  );
}
