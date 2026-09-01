import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from '../lib/gsap';
import { useSectionProgress } from '../lib/useSectionProgress';
import { useInView } from '../lib/useInView';
import { useMagnetic } from '../lib/useMagnetic';

/**
 * 5. Own the dark.
 *
 * Once the directed sequence lands here the camera is handed to OrbitControls
 * so the visitor can turn the bottle themselves. That handover is announced up
 * to <App/>, which also flips pointer-events on the canvas — everywhere above
 * this section the page owns the pointer, so nothing ever eats a scroll.
 */
export function ProductClose({
  reduced,
  magnetic,
  canOrbit,
  onOrbitChange,
}: {
  reduced: boolean;
  magnetic: boolean;
  canOrbit: boolean;
  onOrbitChange: (orbit: boolean) => void;
}) {
  const section = useRef<HTMLElement>(null);
  const ref = section as RefObject<HTMLElement | null>;

  useSectionProgress(ref, 'product');
  useMagnetic(ref, magnetic, 0.34);

  const settled = useInView(ref, { threshold: 0.45 });
  useLayoutEffect(() => {
    onOrbitChange(canOrbit && settled);
  }, [canOrbit, settled, onOrbitChange]);

  useLayoutEffect(() => {
    if (reduced) return;
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', {
        opacity: 0,
        y: 30,
        filter: 'blur(10px)',
        duration: 1.2,
        ease: 'power3.out',
        stagger: 0.11,
        scrollTrigger: { trigger: el, start: 'top 62%', once: true },
      });
    }, el);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={section} className="section product" id="product" aria-labelledby="product-heading">
      <p className="eyebrow eyebrow--gold" data-reveal>
        Eclipse Noir · Eau de Parfum
      </p>
      <h2 className="product__heading" id="product-heading" data-reveal>
        Own the dark
      </h2>
      <p className="product__spec" data-reveal>
        50ml in matte black glass with a brushed-gold disc. Numbered edition of 1,200.
        Ships from Paris in eight weeks.
      </p>

      <button className="cta" type="button" data-magnetic="0.34" data-reveal>
        <span>Pre-order — $185</span>
      </button>

      <p className="spin-hint" data-reveal>
        {canOrbit ? 'Drag to turn the bottle' : 'Matte black glass · brushed gold'}
      </p>
    </section>
  );
}
