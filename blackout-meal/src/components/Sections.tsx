import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { onSectionProgress, useSectionScroll } from "../scene/scrollState";
import { LAYERS } from "../scene/Burger";
import { clamp01 } from "../scene/easing";

gsap.registerPlugin(ScrollTrigger);

/* ----------------------------------------------------------------- masthead */

export function Masthead() {
  return (
    <header className="masthead">
      <a className="masthead__brand" href="#hero">
        Brazen<span className="masthead__long"> Burger Co.</span>
      </a>
      <nav className="masthead__nav" aria-label="Sections">
        <a href="#build" data-magnetic="0.28">
          The Build
        </a>
        <a href="#cold" data-magnetic="0.28">
          Ice Cold
        </a>
        <a href="#order" data-magnetic="0.28">
          Order
        </a>
      </nav>
    </header>
  );
}

/* --------------------------------------------------------------------- hero */

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const wordmark = useRef<HTMLHeadingElement>(null);
  useSectionScroll(ref, "hero");

  useLayoutEffect(() => {
    const el = wordmark.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Blur-to-focus scrubbed by scroll, not a fixed intro animation: the wordmark
    // resolves because the reader moved, and un-resolves if they scroll back up.
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { filter: "blur(15px)", opacity: 0.5, letterSpacing: "0.16em", yPercent: 5 },
        {
          filter: "blur(0px)",
          opacity: 1,
          letterSpacing: "-0.02em",
          yPercent: 0,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ref.current!,
            start: "top top",
            end: "42% top",
            scrub: 0.6,
          },
        },
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="section" id="hero" ref={ref} aria-labelledby="hero-title">
      <div className="hero__inner">
        <div>
          <p className="eyebrow">Brazen Burger Co. presents</p>
          <h1 className="hero__wordmark" id="hero-title" ref={wordmark}>
            <span>The Blackout</span>
            <span className="accent">Meal</span>
          </h1>
          <p className="hero__sub">
            Best burger ever? That's the dare. Double smash, hand-cut fries, and a bottle of
            Brazen Cola pulled straight off the ice.
          </p>
        </div>
        <p className="hero__hint" aria-hidden="true">
          Scroll
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- build */

const INGREDIENTS = [
  { name: "Brioche base", note: "toasted on the flat top" },
  { name: "Butter lettuce", note: "cold, for the contrast" },
  { name: "Double smash patty", note: "4oz each, hard sear" },
  { name: "Aged cheddar", note: "laid on hot, left to run" },
  { name: "Hickory bacon", note: "thick cut, straight off the grill" },
  { name: "Tomato, onion, pickle", note: "sliced to order" },
  { name: "House sauce", note: "smoked, sharp, ours" },
  { name: "Charcoal sesame crown", note: "black brioche, sealed" },
];

type LayerState = "" | "landing" | "landed";

export function Build() {
  const ref = useRef<HTMLElement>(null);
  useSectionScroll(ref, "build");
  const [states, setStates] = useState<LayerState[]>(() => LAYERS.map(() => ""));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStates(LAYERS.map(() => "landed"));
      return;
    }
    let signature = "";
    return onSectionProgress((key, p) => {
      if (key !== "build") return;
      const next = LAYERS.map((l) => {
        const t = clamp01((p - l.at) / l.span);
        return t >= 1 ? "landed" : t > 0 ? "landing" : "";
      }) as LayerState[];
      // One React update per state change, not one per scroll frame.
      const sig = next.join("|");
      if (sig === signature) return;
      signature = sig;
      setStates(next);
    });
  }, []);

  return (
    <section className="section" id="build" ref={ref} aria-labelledby="build-title">
      <div className="sticky">
        <div className="build__panel">
          <p className="eyebrow">02 — The build</p>
          <h2 className="build__title" id="build-title">
            Stacked
            <br />
            Right
          </h2>
          <p className="lede">
            Eight layers, one order, built in the order it has to be built. Bun down, protein
            hot, cheese last thing on before it stops moving.
          </p>
          <ol className="build__list">
            {INGREDIENTS.map((item, i) => (
              <li key={item.name} data-state={states[i] || undefined}>
                <span>
                  {item.name} <span className="build__note">— {item.note}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- cold */

export function Cold() {
  const ref = useRef<HTMLElement>(null);
  useSectionScroll(ref, "cold");

  return (
    <section className="section" id="cold" ref={ref} aria-labelledby="cold-title">
      <div className="sticky cold__inner" data-scrim="right">
        <div className="cold__panel">
          <p className="eyebrow">03 — Brazen Cola</p>
          <h2 className="cold__quote" id="cold-title">
            Cold enough to <em>fight back.</em>
          </h2>
          <p className="lede" style={{ marginLeft: "auto" }}>
            Glass bottle, twelve ounces, kept buried in ice until the second it's yours. It
            arrives already sweating and it does not warm up politely.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- breakdown */

const PANELS = [
  {
    index: "01",
    side: "right" as const,
    title: "Burger",
    copy: "Two 4oz patties smashed thin so the whole surface crusts, aged cheddar melted into the seam, hickory bacon, and a charcoal sesame crown that seals the whole thing shut.",
    spec: "Half pound · Seared hard · Served hot",
  },
  {
    index: "02",
    side: "left" as const,
    title: "Fries",
    copy: "Cut in-house every morning, skin on, blanched and fried a second time for a shell that actually holds. Salted with flake, not dust, while they're still spitting.",
    spec: "Skin on · Twice fried · Flaky salt",
  },
  {
    index: "03",
    side: "right" as const,
    title: "Cola",
    copy: "Brazen Cola in glass, because aluminium changes the edge on it. Deep, dry, and carbonated hard enough that the first sip is a decision.",
    spec: "Glass · 12oz · Straight off the ice",
  },
];

export function Breakdown() {
  const ref = useRef<HTMLElement>(null);
  useSectionScroll(ref, "breakdown");

  return (
    <section className="section" id="breakdown" ref={ref} aria-labelledby="breakdown-title">
      <h2 className="sr-only" id="breakdown-title">
        The meal, component by component
      </h2>
      {PANELS.map((panel) => (
        <article className="panel" key={panel.title} aria-labelledby={`panel-${panel.index}`}>
          <div className="sticky panel__inner" data-align={panel.side} data-scrim={panel.side}>
            <div className="panel__card">
              <p className="panel__index">{panel.index}</p>
              <h3 className="panel__title" id={`panel-${panel.index}`}>
                {panel.title}
              </h3>
              <p className="lede">{panel.copy}</p>
              <p className="panel__spec">{panel.spec}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------- order */

export function Order() {
  const ref = useRef<HTMLElement>(null);
  useSectionScroll(ref, "order");
  // Orbit is offered on fine pointers only: a touch-drag on the canvas would swallow the
  // page scroll, which is exactly the trap this build is meant to avoid.
  const [canSpin, setCanSpin] = useState(false);
  useEffect(() => setCanSpin(window.matchMedia("(pointer: fine)").matches), []);

  return (
    <section className="section" id="order" ref={ref} aria-labelledby="order-title">
      <div className="sticky order__inner" data-scrim="bottom">
        <p className="eyebrow">05 — Order</p>
        <h2 className="order__title" id="order-title">
          Own the Combo
        </h2>
        <p className="lede" style={{ marginInline: "auto", textAlign: "center" }}>
          The Blackout Meal. Burger, fries, cola. No substitutions, no apologies, no
          value-menu energy.
        </p>
        <button className="cta" type="button" data-magnetic="0.42">
          Order — $16.50
        </button>
        {canSpin && (
          <p className="order__hint" aria-hidden="true">
            Drag to spin
          </p>
        )}
        <p className="order__note">
          Served after 4pm at every Brazen location. Allergens listed in store.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- footer */

export function Footer() {
  return (
    <footer className="footer">
      <span>Brazen Burger Co.</span>
      <span>The Blackout Meal</span>
      <span>Est. 2019</span>
    </footer>
  );
}
