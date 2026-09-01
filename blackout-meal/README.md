# The Blackout Meal — Brazen Burger Co.

A photography-led single-page site for The Blackout Meal: double smash burger, hand-cut
fries, and a glass bottle of Brazen Cola.

```bash
npm install
npm run dev
```

## Status: the layout is finished, the photography is not

Every frame on this page is waiting for a real photograph. Until one arrives, each slot
renders its own brief — the shot it needs and how it should be lit — so the page is
explicit about what's missing rather than quietly showing a gap.

**To fill a slot, drop a file into `src/assets/shots/` named after it.** That's the whole
process; the manifest globs the directory and wires it up. No import to add, no config.

| File | Ratio | The shot |
| --- | --- | --- |
| `hero.jpg` | 16:9 | Full meal, three-quarter, shot dark. One hard key upper right. Keep the upper third quiet — the wordmark sits there. |
| `section.jpg` | 4:5 | Portrait. The burger halved so the layers read. Warm light, shallow depth of field. |
| `brioche.jpg` | 1:1 | The charcoal sesame crown alone, sesame catching a raking light. |
| `patty.jpg` | 1:1 | On the griddle mid-sear. Crust, steam, motion. |
| `cheese.jpg` | 1:1 | The melt caught running over the edge. The money shot. |
| `bacon.jpg` | 1:1 | Straight off the grill, still glossy. |
| `stack.jpg` | 1:1 | The finished burger, straight on, hero-lit. |
| `fries.jpg` | 3:2 | Landscape, filling the frame. Salt visible. Hot, not styled to death. |
| `cola.jpg` | 3:2 | Landscape, backlit so the cola glows through the glass. Condensation sharp. |
| `order.jpg` | 16:9 | The whole combo on a dark table. Warm and generous. |

Frames crop rather than letterbox, so an image at the wrong ratio still fills its slot
without changing the page's rhythm — but matching the ratio gives you control over the
crop instead of leaving it to `object-fit`.

Briefs live next to the slots in `src/images/manifest.ts`.

### A note on sourcing

Stock will get you a working page, and Unsplash and Pexels both license their photos for
commercial use without attribution. But stock food photography appears on other people's
sites, and it won't match across ten frames — the burger in the hero won't be the burger
in the cross-section. For anything that ships, this page wants one shoot with consistent
lighting. The briefs above are written to hand to a photographer.

## Structure

| Section | What it does |
| --- | --- |
| Hero | Full-bleed photograph, wordmark over a gradient scrim |
| The meal | Bone-paper reading block, portrait photo, spec list |
| What's in it | A sticky photograph that cross-fades as you scroll the ingredient list beside it |
| Fries / Cola | Full-bleed panels, copy on a directional scrim, alternating sides |
| Order | Price, CTA, hours |

## Design

**Palette.** Warm near-black (`#100d0b`) where the food is, bone (`#f4efe4`) where the
words are, and the rhythm between them is the design. One accent: a brick red (`#a8231b`)
that reads hungrier than a fire-engine red, used on the eyebrows and the CTA and nothing
else.

**Type.** Fraunces for display — a variable serif with optical sizing, so the large
settings tighten their joins and sharpen their contrast rather than just scaling up. Karla
for body and labels, which has enough character to avoid reading as a default UI font.

**Motion.** Photography wants a mask, not a fade: a frame that opens reads as a shutter, a
frame that fades reads as a slideshow. Images reveal via a scroll-linked `clip-path` and
drift slowly inside their frames; copy rises once and stops. That's all of it.

## Accessibility

- All copy is real DOM text with landmarks and heading order; every photograph carries alt
  text written for a screen reader, and placeholder slots expose the same text via
  `role="img"` and `aria-label`.
- No scroll jacking anywhere. The build section holds its image with CSS `position:
  sticky`, never a pinned overlay, so arrow keys, Space, Page Up/Down, Home and End all
  behave natively.
- A skip link to the order section, revealed on focus.
- `prefers-reduced-motion: reduce` disables the reveals, the parallax drift and the
  cross-fade; everything renders in its final state and the page scrolls normally.

## Performance

The bundle is ~204KB (64KB gzipped) — React plus this page's own code, no 3D runtime and
no animation library. Images are `loading="lazy"` except the hero, `decoding="async"`, and
the parallax runs on a single rAF-throttled scroll listener that writes one `transform`.

Before shipping, run the photographs through an image pipeline: serve AVIF/WebP with
`<picture>`, generate widths for `srcset`, and set `sizes` on each `Shot` (the prop is
already threaded through). At full-bleed sizes that is the difference between a 400KB page
and a 6MB one.

## Previous version

This page was previously built as a real-time WebGL scene with the burger assembled from
procedural geometry. It's in the git history if you want it — it was technically the more
impressive artefact, and the wrong answer: procedurally modelled food reads as a render,
and a render doesn't make anyone hungry.
