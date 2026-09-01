import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from '../lib/gsap';
import { useSectionProgress } from '../lib/useSectionProgress';

/**
 * 2. Totality — the centrepiece.
 *
 * The DOM here is deliberately quiet: the copy sits at the section's centre so
 * it reads at exactly the scroll position where the camera's arc puts the gold
 * cap behind the cylinder and the key light collapses.
 */
export function Totality({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);

  useSectionProgress(section as RefObject<HTMLElement | null>, 'totality');

  useLayoutEffect(() => {
    if (reduced) return;
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', {
        opacity: 0,
        y: 34,
        filter: 'blur(10px)',
        duration: 1.2,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 62%', once: true },
      });

      // The copy dims through the eclipse itself, then comes back — the page
      // loses light at the same moment the scene does.
      gsap.to('[data-dim]', {
        opacity: 0.35,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top 12%',
          end: 'center center',
          scrub: 0.5,
        },
      });
      gsap.to('[data-dim]', {
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'center center',
          end: 'bottom 65%',
          scrub: 0.5,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={section}
      className="section totality"
      id="totality"
      aria-labelledby="totality-heading"
    >
      <div className="totality__inner">
      <p className="totality__clock" data-reveal>
        11:41:07 — Second contact
      </p>
      <h2 className="totality__heading" id="totality-heading" data-reveal>
        Totality
      </h2>
      <p className="totality__copy lede" data-reveal data-dim>
        The sun goes out and the temperature drops four degrees. Birds stop mid-sentence.
        For a minute and a half the sky is wrong in a way you will keep describing badly
        for the rest of your life. That minute and a half is the fragrance.
      </p>
      <p className="eyebrow" data-reveal>
        Black pepper · Obsidian musk · Burnt vanilla
      </p>
      </div>
    </section>
  );
}
