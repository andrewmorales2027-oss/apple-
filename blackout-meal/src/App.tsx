import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Scene } from "./scene/Scene";
import { Cursor } from "./components/Cursor";
import { Breakdown, Build, Cold, Footer, Hero, Masthead, Order } from "./components/Sections";
import { useReducedMotion } from "./lib/reducedMotion";
import { applyStylePalette, getStyle } from "./scene/style";

export default function App() {
  const reduced = useReducedMotion();

  // The chosen direction owns the page palette too, not just the render — a print look on
  // a black page is neither of the two things it is trying to be.
  useEffect(() => {
    applyStylePalette(getStyle());
  }, []);

  // Fonts and the canvas both change layout height on arrival; a stale ScrollTrigger
  // start/end is what makes these pages fire their beats a screen early.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts?.ready) document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => window.removeEventListener("load", refresh);
  }, []);

  return (
    <>
      {/* Visible, not just focus-revealed: the directed sequence is long, and anyone who
          wants the price rather than the film should be able to leave at any moment. */}
      <a className="skip-link" href="#order">
        Skip to order
      </a>

      <Scene reduced={reduced} />
      <Cursor />

      <div className="content">
        <Masthead />
        <main>
          <Hero />
          <Build />
          <Cold />
          <Breakdown />
          <Order />
        </main>
        <Footer />
      </div>
    </>
  );
}
