import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Scene } from "./scene/Scene";
import { Cursor } from "./components/Cursor";
import { Breakdown, Build, Cold, Footer, Hero, Masthead, Order } from "./components/Sections";
import { useReducedMotion } from "./lib/reducedMotion";

export default function App() {
  const reduced = useReducedMotion();

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
