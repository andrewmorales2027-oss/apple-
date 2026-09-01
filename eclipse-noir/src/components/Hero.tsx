import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { useSectionProgress } from '../lib/useSectionProgress';

/**
 * 1. First contact.
 *
 * The wordmark resolves out of blur on load, then goes back out of focus as the
 * page scrolls — the blur is driven by scroll, not by a fixed CSS animation, so
 * it tracks the scrub in both directions.
 */
export function Hero({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const wordmark = useRef<HTMLHeadingElement>(null);
  const meta = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);

  useSectionProgress(section as RefObject<HTMLElement | null>, 'hero');

  useLayoutEffect(() => {
    if (reduced) return;
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const words = wordmark.current?.querySelectorAll('.word') ?? [];

      gsap.set(words, { filter: 'blur(26px)', opacity: 0, yPercent: 14 });
      gsap.set([meta.current, foot.current], { opacity: 0, y: 20 });

      const intro = gsap.timeline({ delay: 0.25 });
      intro
        .to(words, {
          filter: 'blur(0px)',
          opacity: 1,
          yPercent: 0,
          duration: 1.7,
          ease: 'expo.out',
          stagger: 0.14,
        })
        .to([meta.current, foot.current], {
          opacity: 1,
          y: 0,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.1,
        }, '-=1.05');

      // Same blur/opacity treatment, now tied to the scrubbed scroll position.
      gsap.to(wordmark.current, {
        filter: 'blur(18px)',
        opacity: 0,
        yPercent: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom 55%',
          scrub: 0.6,
        },
      });

      gsap.to([meta.current, foot.current], {
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom 70%', scrub: 0.4 },
      });
    }, el);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={section} className="section hero" id="top" aria-labelledby="hero-heading">
      <div className="hero__inner">
        <p className="eyebrow">Maison Vesper · Eau de Parfum</p>

        <h1 ref={wordmark} className="hero__wordmark" id="hero-heading">
          <span className="word">Eclipse</span>
          <span className="word">Noir</span>
        </h1>

        <div ref={meta} className="hero__meta">
          <p>
            Ninety seconds of totality, bottled. Cold light, hot shadow, static in the air.
          </p>
          <p className="eyebrow eyebrow--gold">50ml · $185</p>
        </div>
      </div>

      <div ref={foot} className="hero__foot">
        <p className="scroll-hint">
          <span className="scroll-hint__track" aria-hidden="true" />
          Scroll into shadow
        </p>
        {/* Visible, always-present escape hatch out of the directed sequence. */}
        <a className="skip-visible" href="#product">
          Skip to product
        </a>
      </div>
    </section>
  );
}
