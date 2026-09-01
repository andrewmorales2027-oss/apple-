import { useEffect, useRef, useState } from "react";
import { Shot } from "./Shot";
import { BUILD_STEPS } from "../images/manifest";
import { useReveal, useRise } from "../lib/reveal";

/* ---------------------------------------------------------------- masthead */

export function Masthead() {
  return (
    <header className="masthead">
      <a className="masthead__brand" href="#top">
        Brazen Burger Co.
      </a>
      <nav className="masthead__nav" aria-label="Sections">
        <a href="#meal">The Meal</a>
        <a href="#build">What&rsquo;s In It</a>
        <a className="masthead__cta" href="#order">
          Order
        </a>
      </nav>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

export function Hero() {
  const frame = useReveal<HTMLDivElement>();
  const copy = useRise<HTMLDivElement>();

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="reveal" ref={frame}>
        <Shot id="hero" parallax={0.1} priority />
      </div>
      <div className="hero__scrim" aria-hidden="true" />
      <div className="hero__copy rise" ref={copy}>
        <p className="eyebrow">Brazen Burger Co.</p>
        <h1 className="hero__title" id="hero-title">
          The Blackout
          <em>Meal</em>
        </h1>
        <p className="hero__meta">
          <span>Double smash</span>
          <span>Hand-cut fries</span>
          <span>Brazen Cola</span>
          <span>$16.50</span>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- intro */

export function Intro() {
  const copy = useRise<HTMLDivElement>();
  const frame = useReveal<HTMLDivElement>();

  return (
    <section className="intro" id="meal" aria-labelledby="meal-title">
      <div className="rise" ref={copy}>
        <p className="eyebrow">01 — The meal</p>
        <h2 className="intro__title" id="meal-title">
          Built to be ordered once and remembered for a week.
        </h2>
        <div className="intro__body">
          <p className="lede">
            Two quarter-pound patties pressed thin on a 500&deg; flat top, so the whole face
            crusts instead of just the edges. Aged cheddar goes on while they&rsquo;re still
            moving. Hickory bacon, house sauce, and a charcoal sesame brioche that holds
            together to the last bite.
          </p>
          <p className="lede">
            It comes with hand-cut fries and a glass bottle of Brazen Cola pulled off the
            ice. No substitutions. There is no small version.
          </p>
        </div>
        <dl className="intro__spec">
          <div>
            <b>Serves</b> One, honestly
          </div>
          <div>
            <b>Available</b> Daily from 4pm, until it runs out
          </div>
          <div>
            <b>Allergens</b> Wheat, dairy, egg. Ask us about anything else.
          </div>
        </dl>
      </div>
      <div className="reveal" ref={frame}>
        <Shot id="section" parallax={0.14} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- build */

/**
 * The ingredient walk-through: a sticky photograph that changes as the reader moves
 * down the list beside it. This is the photographic equivalent of watching it get
 * built — and unlike a scrubbed 3D sequence, every step is real DOM text with a real
 * heading, so it reads perfectly with the images off or a screen reader on.
 */
export function Build() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // The step nearest the middle of the viewport owns the frame.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = steps.current.indexOf(visible.target as HTMLLIElement);
        if (index >= 0) setActive(index);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.5, 1] },
    );
    steps.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="build" id="build" aria-labelledby="build-title">
      <div className="build__inner">
        {/* All five frames are stacked in one grid cell and cross-faded, so the image
            never reflows and the swap costs nothing but opacity. */}
        <div className="build__frame" aria-hidden="true">
          {BUILD_STEPS.map((step, i) => (
            <Shot
              key={step.shot}
              id={step.shot}
              parallax={0}
              className={i === active ? "is-active" : undefined}
            />
          ))}
        </div>

        <div>
          <p className="eyebrow">02 — What&rsquo;s in it</p>
          <h2 className="sr-only" id="build-title">
            What goes into the Blackout Meal
          </h2>
          <ol className="build__steps">
            {BUILD_STEPS.map((step, i) => (
              <li
                key={step.name}
                className="build__step"
                data-active={i === active}
                ref={(el) => {
                  steps.current[i] = el;
                }}
              >
                <h3>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {step.name}
                </h3>
                <p>{step.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ panels */

function Panel({
  id,
  shotId,
  side,
  eyebrow,
  title,
  body,
  spec,
}: {
  id: string;
  shotId: "fries" | "cola";
  side: "left" | "right";
  eyebrow: string;
  title: string;
  body: string;
  spec: string;
}) {
  const frame = useReveal<HTMLDivElement>();
  const copy = useRise<HTMLDivElement>();

  return (
    <section
      className={`panel ${side === "right" ? "panel--right" : ""}`}
      id={id}
      aria-labelledby={`${id}-title`}
    >
      <div className="reveal" ref={frame}>
        <Shot id={shotId} parallax={0.16} />
      </div>
      <div className="panel__scrim" aria-hidden="true" />
      <div className="panel__copy rise" ref={copy}>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{body}</p>
        <p className="panel__spec">{spec}</p>
      </div>
    </section>
  );
}

export function Fries() {
  return (
    <Panel
      id="fries"
      shotId="fries"
      side="left"
      eyebrow="03 — The fries"
      title="Cut this morning."
      body="Skin on, blanched, and fried a second time so the shell actually holds. Salted with flake while they're still spitting."
      spec="Skin on · Twice fried · Flaky salt"
    />
  );
}

export function Cola() {
  return (
    <Panel
      id="cola"
      shotId="cola"
      side="right"
      eyebrow="04 — The cola"
      title="Cold enough to fight back."
      body="Brazen Cola in glass, because aluminium changes the edge on it. Kept buried in ice until the second it's yours."
      spec="Glass · 12oz · Straight off the ice"
    />
  );
}

/* ------------------------------------------------------------------- order */

export function Order() {
  const copy = useRise<HTMLDivElement>();
  const frame = useReveal<HTMLDivElement>();

  return (
    <section className="order" id="order" aria-labelledby="order-title">
      <div className="reveal" ref={frame}>
        <Shot id="order" parallax={0.12} />
      </div>
      <div className="rise" ref={copy}>
        <p className="eyebrow">05 — Order</p>
        <h2 className="order__title" id="order-title">
          Own the combo.
        </h2>
        <p className="lede">
          Burger, fries, cola. Available daily from 4pm at every Brazen location, and gone
          when it&rsquo;s gone.
        </p>
        <p className="order__price">
          $16.50 <small>The Blackout Meal</small>
        </p>
        <button className="cta" type="button">
          Order now
        </button>
        <p className="order__hours">
          Mon&ndash;Thu 4&ndash;11pm · Fri&ndash;Sat 4pm&ndash;1am · Sun 4&ndash;10pm
        </p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span>Brazen Burger Co.</span>
      <span>The Blackout Meal</span>
      <span>Est. 2019</span>
    </footer>
  );
}
