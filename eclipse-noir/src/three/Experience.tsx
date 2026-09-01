import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { Stage } from './Stage';
import { Effects } from './Effects';

export type Quality = 'high' | 'low';

/**
 * Initial quality guess before a single frame has been drawn. Anything coarse
 * pointing, low core count or low reported memory starts on the cheap path and
 * is never promoted — better to be quietly smooth than briefly beautiful.
 */
export function guessQuality(): Quality {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (coarse || cores <= 4 || memory <= 4) return 'low';
  return 'high';
}

type ExperienceProps = {
  reduced: boolean;
  showRing: boolean;
  orbit: boolean;
  onQualityChange?: (q: Quality) => void;
};

export function Experience({ reduced, showRing, orbit, onQualityChange }: ExperienceProps) {
  const [quality, setQuality] = useState<Quality>(guessQuality);
  const [dpr, setDpr] = useState(() => (guessQuality() === 'high' ? 1.6 : 1));
  const degraded = useRef(false);

  const degrade = () => {
    if (degraded.current) return;
    degraded.current = true;
    setQuality('low');
    setDpr(1);
    onQualityChange?.('low');
  };

  return (
    <Canvas
      dpr={[1, dpr]}
      // Tone mapping happens in the composer; leaving it on here too would
      // apply the ACES curve twice.
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
      }}
      camera={{ fov: 34, near: 0.1, far: 120, position: [0, 0.44, 5.7] }}
      // Reduced motion: render on demand only. Nothing animates, so nothing is
      // drawn — no rAF loop, no GPU spin, no battery burn.
      frameloop={reduced ? 'demand' : 'always'}
      resize={{ scroll: false }}
    >
      <PerformanceMonitor
        ms={250}
        iterations={6}
        threshold={0.75}
        onDecline={degrade}
        // Never climb back up mid-session; thrashing quality looks worse than
        // sitting on the cheap path.
        flipflops={2}
        onFallback={degrade}
      />
      <Suspense fallback={null}>
        <Stage reduced={reduced} quality={quality} showRing={showRing} orbit={orbit} />
        <Effects quality={quality} reduced={reduced} />
      </Suspense>
    </Canvas>
  );
}
