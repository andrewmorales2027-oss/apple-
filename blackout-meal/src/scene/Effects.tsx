import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { getQuality } from "../lib/quality";

/**
 * The filmic layer, kept deliberately thin.
 *
 * Bloom is thresholded high enough that it only catches the cheese emissive and the
 * specular hits on the condensation and the glass — turn the threshold down and the whole
 * frame starts glowing, which is what makes these scenes look like a demo.
 *
 * DepthOfField is not mounted (see DOF_ENABLED in lib/quality.ts): it costs roughly
 * 4-6ms/frame at 1080p on integrated graphics, which is the whole 60fps budget on the
 * mid-tier hardware this is aimed at. It is the first thing to add back if you profile
 * headroom, and the first thing to cut if you don't.
 */
export function Effects() {
  const { postprocessing } = getQuality();
  if (!postprocessing) return null;

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        luminanceThreshold={0.72}
        luminanceSmoothing={0.18}
        intensity={0.55}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      <Vignette offset={0.28} darkness={0.62} eskil={false} />
    </EffectComposer>
  );
}
