import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";
import { getQuality } from "../lib/quality";
import { focusTarget } from "./focus";

/**
 * The filmic layer, kept deliberately thin.
 *
 * Bloom is thresholded high enough that it only catches the cheese emissive and the
 * specular hits on the condensation and the glass — turn the threshold down and the whole
 * frame starts glowing, which is what makes these scenes look like a demo.
 *
 * Depth of field runs on the high tier only. It costs roughly 4-6ms/frame at 1080p on
 * integrated graphics, which is the entire difference between 60 and 45fps on mid-tier
 * hardware, so mid and low do without it — and it remains the first thing to cut if the
 * budget tightens again. Where it does run, it auto-focuses on the camera's own look
 * target (see focus.ts) so the subject of each beat stays sharp while the table and the
 * other props fall away. Kept shallow-but-not-showy: a large bokeh turns the sesame
 * seeds on an in-flight bun into a field of grey discs, which is a lens effect nobody
 * asked for.
 *
 * Chromatic aberration is set just above the threshold of conscious visibility. Real
 * lenses fringe; the point is that the frame stops looking mathematically perfect, not
 * that anyone notices colour splitting.
 */
export function Effects() {
  const { postprocessing, dof } = getQuality();
  if (!postprocessing) return null;

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      {dof ? (
        <DepthOfField
          target={focusTarget}
          // World units, NOT a 0..1 fraction — postprocessing's own `focusRange` getter
          // doc claims "Range: [0.0, 1.0]", but the CoC shader computes
          // `smoothstep(0.0, focusRange, abs(distance - focusDistance))` on a world-space
          // distance.
          //
          // Note there is no flat in-focus zone in that curve: every depth off the focal
          // plane gets some blur. So the range has to be wide enough that the subject's
          // own depth lands in the negligible tail. The burger is ~2.4 units deep, so at
          // 12 its front and back come out around 0.02 CoC (genuinely crisp) while the
          // table and the far props still run soft. Anything under ~6 visibly mushes the
          // hero, which is the opposite of what a shallow lens is supposed to buy you.
          focusRange={12}
          bokehScale={2.6}
          resolutionScale={0.5}
        />
      ) : (
        <></>
      )}
      <Bloom
        luminanceThreshold={0.72}
        luminanceSmoothing={0.18}
        intensity={0.55}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      <ChromaticAberration
        offset={new THREE.Vector2(0.0007, 0.0007)}
        radialModulation
        modulationOffset={0.42}
      />
      <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      <Vignette offset={0.28} darkness={0.62} eskil={false} />
    </EffectComposer>
  );
}
