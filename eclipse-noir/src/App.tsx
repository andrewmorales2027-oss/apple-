import { useCallback, useEffect, useState } from 'react';
import { Experience } from './three/Experience';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { Totality } from './components/Totality';
import { Corona } from './components/Corona';
import { Notes } from './components/Notes';
import { ProductClose } from './components/ProductClose';
import { Footer } from './components/Footer';
import { Cursor } from './components/Cursor';
import { useMediaQuery, useReducedMotion } from './lib/useReducedMotion';
import { ScrollTrigger } from './lib/gsap';

export default function App() {
  const reduced = useReducedMotion();
  const pointerFine = useMediaQuery('(pointer: fine)');

  const [ringNear, setRingNear] = useState(false);
  const [orbit, setOrbit] = useState(false);

  // Custom cursor and magnetic pull are desktop-only *and* motion-optional.
  const flourishes = pointerFine && !reduced;

  const handleRingNear = useCallback((near: boolean) => setRingNear(near), []);
  const handleOrbit = useCallback((next: boolean) => setOrbit(next), []);

  // Fonts land after first paint and change every measured height.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh).catch(() => {});
    const t = window.setTimeout(refresh, 600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <a className="skip-link" href="#product">
        Skip to product
      </a>

      <div className="stage" data-interactive={String(orbit)} aria-hidden="true">
        <Experience reduced={reduced} showRing={ringNear || reduced} orbit={orbit} />
      </div>

      <Nav magnetic={flourishes} />

      <main className="page">
        <Hero reduced={reduced} />
        <Totality reduced={reduced} />
        <Corona reduced={reduced} onNearChange={handleRingNear} />
        <Notes reduced={reduced} />
        <ProductClose
          reduced={reduced}
          magnetic={flourishes}
          canOrbit={pointerFine}
          onOrbitChange={handleOrbit}
        />
      </main>

      <Footer />

      {flourishes && <Cursor />}
    </>
  );
}
