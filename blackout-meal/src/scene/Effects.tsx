import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  ColorDepth,
  DepthOfField,
  DotScreen,
  EffectComposer,
  HueSaturation,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";
import { getQuality } from "../lib/quality";
import { focusTarget } from "./focus";
import { getStyle } from "./style";

/**
 * The grade. Which passes run is a property of the chosen style, not a fixed chain —
 * posterisation and halftone are the whole point of the print direction and would ruin
 * the photoreal one, so nothing here is "always on".
 *
 * Depth of field runs on the high tier only, and only in the directions that want it. It
 * costs roughly 4-6ms/frame at 1080p on integrated graphics, which is the whole difference
 * between 60 and 45fps on mid-tier hardware, and it remains the first thing to cut.
 *
 * Where it does run it auto-focuses on the camera's own subject (see focus.ts) so each
 * beat's hero stays sharp. Note `focusRange` is in world units despite postprocessing's
 * own getter doc claiming [0.0, 1.0]: the CoC shader does
 * `smoothstep(0.0, focusRange, abs(distance - focusDistance))` on a world distance, and
 * there is no flat in-focus zone in that curve — so the range has to be wide enough that
 * the subject's own depth lands in the negligible tail.
 */
export function Effects() {
  const { postprocessing, dof } = getQuality();
  const style = getStyle();
  const fx = style.effects;
  if (!postprocessing) return null;

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      {dof && fx.dof ? (
        <DepthOfField target={focusTarget} focusRange={12} bokehScale={2.2} resolutionScale={0.5} />
      ) : (
        <></>
      )}

      {fx.bloom ? (
        <Bloom
          luminanceThreshold={fx.bloom.threshold}
          luminanceSmoothing={0.18}
          intensity={fx.bloom.intensity}
          kernelSize={KernelSize.MEDIUM}
          mipmapBlur
        />
      ) : (
        <></>
      )}

      {fx.saturation !== 0 || fx.contrast !== 0 ? (
        <HueSaturation saturation={fx.saturation} hue={0} />
      ) : (
        <></>
      )}
      {fx.contrast !== 0 ? <BrightnessContrast brightness={0} contrast={fx.contrast} /> : <></>}

      {/* Posterise before the halftone, so the dots break up flat inks rather than a
          continuous gradient — which is the order a real press works in. */}
      {fx.colorDepth ? <ColorDepth bits={fx.colorDepth} /> : <></>}
      {fx.dotScreen ? (
        // OVERLAY: preserves mid luminance. MULTIPLY is how ink physically works but it
        // halves the whole frame, and soft-light shifted channels unevenly against a
        // bright ground and washed the page cyan.
        <DotScreen blendFunction={BlendFunction.OVERLAY} scale={fx.dotScreen.scale} angle={Math.PI * 0.25} />
      ) : (
        <></>
      )}

      {fx.chromatic ? (
        <ChromaticAberration
          offset={new THREE.Vector2(fx.chromatic, fx.chromatic)}
          radialModulation
          modulationOffset={0.42}
        />
      ) : (
        <></>
      )}

      <Noise opacity={fx.grain} blendFunction={BlendFunction.OVERLAY} />

      {fx.vignette ? (
        <Vignette offset={fx.vignette.offset} darkness={fx.vignette.darkness} eskil={false} />
      ) : (
        <></>
      )}
    </EffectComposer>
  );
}
