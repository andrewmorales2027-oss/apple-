import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from '../lib/gsap';
import { useSectionProgress } from '../lib/useSectionProgress';

type Panel = {
  id: string;
  stage: string;
  title: string;
  desc: string;
  notes: Array<[string, string]>;
};

const PANELS: Panel[] = [
  {
    id: 'top',
    stage: '01 / Top',
    title: 'Cold open',
    desc: 'The first minute. Sharp, bright, faintly electric — the air before the light goes.',
    notes: [
      ['Black pepper', 'dry, cracked'],
      ['Blood orange peel', 'bitter, cold'],
      ['Ozone accord', 'static'],
    ],
  },
  {
    id: 'heart',
    stage: '02 / Heart',
    title: 'Totality',
    desc: 'The centre of the fragrance and the centre of the eclipse. Smoke with no fire under it.',
    notes: [
      ['Obsidian musk', 'opaque'],
      ['Incense smoke', 'resinous'],
      ['Dark iris', 'powdered, cool'],
    ],
  },
  {
    id: 'base',
    stage: '03 / Base',
    title: 'After-image',
    desc: 'What stays on skin six hours later. Warm at last, and slightly scorched.',
    notes: [
      ['Amber resin', 'dense'],
      ['Labdanum', 'leathered'],
      ['Burnt vanilla', 'a whisper'],
    ],
  },
];

/**
 * 4. Notes — top / heart / base.
 *
 * Each panel holds briefly at the viewport centre via `position: sticky`
 * rather than a ScrollTrigger pin. Same read, but the page never stops being a
 * normally-scrolling document: arrow keys, Space, Page Up/Down, Home/End and a
 * screen reader's virtual cursor all behave exactly as they would anywhere else.
 *
 * All copy is real DOM text — the canvas behind it carries the light, not the words.
 */
export function Notes({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(0);

  useSectionProgress(section as RefObject<HTMLElement | null>, 'notes');

  useLayoutEffect(() => {
    if (reduced) return;
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      el.querySelectorAll<HTMLElement>('.note-panel').forEach((panel) => {
        gsap.from(panel.querySelectorAll('[data-reveal]'), {
          opacity: 0,
          y: 26,
          filter: 'blur(9px)',
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.1,
          scrollTrigger: { trigger: panel, start: 'top 72%', once: true },
        });
      });
    }, el);

    return () => ctx.revert();
  }, [reduced]);

  // Which panel currently owns the centre line — drives the sticky index only.
  useEffect(() => {
    const el = section.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const panels = Array.from(el.querySelectorAll<HTMLElement>('.note-panel'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setCurrent(panels.indexOf(entry.target as HTMLElement));
        });
      },
      { rootMargin: '-48% 0px -48% 0px' },
    );
    panels.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, []);

  return (
    <section ref={section} className="section notes" id="notes" aria-labelledby="notes-heading">
      <h2 className="sr-only" id="notes-heading">
        The notes
      </h2>

      <ol className="notes__index" aria-hidden="true">
        {PANELS.map((panel, i) => (
          <li key={panel.id} data-current={String(i === current)}>
            {panel.id}
          </li>
        ))}
      </ol>

      {PANELS.map((panel) => (
        <article className="note-panel" key={panel.id} aria-labelledby={`note-${panel.id}`}>
          <div className="note-panel__card">
            <div className="note-panel__stage">
              <span className="note-panel__num" data-reveal>
                {panel.stage}
              </span>
            </div>
            <h3 className="note-panel__title" id={`note-${panel.id}`} data-reveal>
              {panel.title}
            </h3>
            <p className="note-panel__desc" data-reveal>
              {panel.desc}
            </p>
            <ul className="note-list">
              {panel.notes.map(([name, qualifier]) => (
                <li key={name}>
                  {name}
                  <span>{qualifier}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </section>
  );
}
