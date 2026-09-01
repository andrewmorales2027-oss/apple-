import { EffectComposer, Bloom, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';

/**
 * The filmic layer, kept deliberately thin.
 *
 * DepthOfField is *not* here. Bloom + a transmission pass already costs two
 * extra full-screen passes; DoF was the first thing to go when budgeting for a
 * mid-tier laptop and a mid-range phone (see README → Performance).
 *
 * Tone mapping runs as an effect rather than on the renderer: inside an
 * EffectComposer the scene is rendered to a float target where three's
 * in-shader tone mapping does not apply, so doing it here is the only way to
 * get one ACES curve and not zero or two.
 */
export function Effects({ quality, reduced }: { quality: 'high' | 'low'; reduced: boolean }) {
  return (
    <EffectComposer multisampling={quality === 'high' ? 4 : 0} enableNormalPass={false}>
      <Bloom
        // High threshold on purpose: only the gold cap, the hairline seam and
        // the corona are hot enough to bloom. Nothing else on the page glows.
        luminanceThreshold={0.62}
        luminanceSmoothing={0.18}
        intensity={quality === 'high' ? 0.95 : 0.6}
        radius={0.72}
        mipmapBlur
      />
      <Vignette offset={0.28} darkness={0.62} blendFunction={BlendFunction.NORMAL} />
      {/* Film grain animates every frame, so it is motion — off under
          prefers-reduced-motion, where the canvas renders on demand only.
          It stays on for the low-quality path: a page this dark bands badly in
          8-bit, and the grain is what dithers it away. */}
      {!reduced ? (
        <Noise premultiply opacity={quality === 'high' ? 0.022 : 0.03} blendFunction={BlendFunction.OVERLAY} />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
