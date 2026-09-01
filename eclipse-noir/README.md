# Eclipse Noir — Maison Vesper

A single-page, scroll-driven 3D product site for a fictional eau de parfum built
around the ninety seconds of totality during a solar eclipse.

```bash
npm install
npm run dev      # http://localhost:5173
```

No asset downloads are needed to see the full experience: the bottle, the cap,
the corona and the environment lighting are all built in code. The only network
request the page makes is for two Google fonts, and it degrades to a condensed
system stack without them.

---

## What's actually on the page

One `<Canvas>` is fixed behind the whole document; five DOM sections scroll over
it and publish their 0–1 progress into a plain mutable object that the render
loop reads. Nothing about the scroll is hijacked — see *Accessibility* below.

| # | Section | The 3D beat |
|---|---------|-------------|
| 1 | **First contact** | Bottle still, dim, one hard rim light. Wordmark resolves out of `blur(26px)`, then goes back out of focus on a scrubbed ScrollTrigger. |
| 2 | **Totality** | Half-orbit. At `progress = 0.5` the gold cap is fully occluded by the black cylinder, the key light collapses to 8%, and the corona flares. |
| 3 | **The corona** | A thin refractive torus (`MeshTransmissionMaterial`) turns around the bottle. The page's one glass moment. |
| 4 | **Top / Heart / Base** | Three panels hold at the viewport centre while the scene walks from ozone-cool to amber-warm. |
| 5 | **Own the dark** | Camera settles front-on, then hands over to `OrbitControls` so you can turn the bottle yourself. |

### The eclipse is real geometry, not a fade

This is blocked out deliberately in `src/three/choreography.ts`, not left to
chance in an orbit path:

- black cylinder — radius `1.00`, half-height `0.275`, on the origin
- gold cap — radius `0.40`, offset to `x = +0.30`, spanning `y` `0.275 → 0.345`
- at totality the camera sits at azimuth `π`, i.e. `(-4.25, -0.07, 0)`

The sight-line grazing the cylinder's near top rim passes *above* every point of
the cap — at `x = -1` the ray to the cap's nearest top corner is at `y = 0.255`,
below the rim at `0.275`. The disc is occluded by the body of the bottle, and
what survives is a gold arc cresting the black rim. Camera framing is
aspect-corrected (`fit` in `Stage.tsx`), so this composition holds on a phone.

---

## `prefers-reduced-motion: reduce`

Detected live (flipping the OS setting re-renders the page), and it disables:

- **the entire scroll-driven camera rig** — no ScrollTrigger scrubs, no
  `useFrame` writes; the camera is set once to a static three-quarter pose
- **the canvas render loop** — `frameloop="demand"`, so after the first frame
  nothing is drawn at all: no rAF, no GPU spin, no battery burn
- **film grain** — `Noise` animates per frame, so it is motion and it goes
- **the corona flare, the light collapse and the ozone→amber walk** — the scene
  holds one static, evenly-lit state
- **the sticky note panels** — they become normal flowing blocks
- **the custom cursor and the magnetic buttons** — a control that moves away
  from the pointer is exactly what the setting exists to stop
- **the blur-to-focus wordmark** — rendered sharp and opaque from the start
- **every GSAP reveal** — final state, no `from` tween

What stays: the same copy, the same sections, the same headings, the same 3D
scene as a still image, and `OrbitControls` — that one is user-initiated, not
autoplay, so it isn't the kind of motion the setting is about.

Bloom and the ACES tone map stay too: they're a static look, not movement.

The reduced-motion page is ~4,300px tall instead of ~6,200px, and reads
top-to-bottom as an ordinary article.

---

## Performance and the fallback path

Budget: a mid-tier laptop and a mid-range phone, not the dev machine.

**`DepthOfField` is not shipped.** Bloom plus the transmission pass already
cost two extra full-screen passes; DoF was the first thing dropped and it is not
in the composer at all. If you add it back, put it behind the `quality === 'high'`
branch in `src/three/Effects.tsx` and re-measure.

**Quality tiers.** `guessQuality()` in `src/three/Experience.tsx` starts on the
cheap path for coarse pointers, `hardwareConcurrency <= 4` or
`deviceMemory <= 4`. drei's `PerformanceMonitor` demotes at runtime, and never
promotes back — thrashing quality looks worse than sitting on the cheap path.

| | high | low |
|---|---|---|
| DPR cap | 1.6 | 1.0 |
| Corona ring | `MeshTransmissionMaterial`, `samples 4`, `resolution 256` | `meshPhysicalMaterial`, no transmission pass at all |
| Torus tessellation | 20 × 160 | 12 × 96 |
| MSAA | 4 | 0 |
| Environment cubemap | 128 | 64 |
| Bloom | 0.95 | 0.6 |
| Grain | 0.022 | 0.03 |

**Other things that cost nothing.** The transmission ring is only *mounted*
while section 3 is within ~60% of the viewport — an `IntersectionObserver`
mounts and unmounts it, so its extra render target does not exist for the other
four sections. The procedural environment renders one cubemap frame at mount and
is never re-rendered; the eclipse dims real light intensities and
`scene.environmentIntensity` instead of animating the environment. Scroll
progress lives in a mutable object, never React state, so scrolling causes zero
re-renders.

**If it's still not smooth**, in this order: drop the corona ring to the cheap
material for everyone (`quality` prop in `Stage.tsx`), then drop the DPR cap to
1, then drop `Bloom` — the gold cap still reads without it.

The grain is kept on the low path deliberately: a page this dark bands badly in
8-bit, and the grain is what dithers it away.

---

## Accessibility

- **All copy is real DOM text.** Nothing is baked into the canvas. The canvas is
  `aria-hidden` and carries no information the text doesn't.
- **No scroll-jacking.** There is no pinning, no `position: fixed` scroll-lock,
  no smooth-scroll library, no ScrollTrigger scroller-proxy. ScrollTrigger only
  *reads* the native scroll position. The "pinned" note panels are
  `position: sticky`, which the browser handles natively.
- **Keyboard, verified:** Page Up/Page Down, ↑/↓, Space, Home and End all scroll
  normally inside the directed camera section — no `keydown` handler on the page
  calls `preventDefault`. The mouse wheel over the canvas scrolls the page
  rather than zooming the scene (`enableZoom={false}` returns before
  `preventDefault`).
- **A visible "Skip to product" link** sits in the hero next to the scroll hint,
  and a second one is the first tab stop on the page.
- **Landmarks and heading order:** `nav` → `main` → `footer`; `h1` Eclipse Noir,
  then one `h2` per section, with the three note panels as `h3`s under the notes
  `h2`.
- **Touch devices** get no custom cursor, no magnetic pull, and no
  `OrbitControls` — the last one because it sets `touch-action: none` on the
  canvas, which would eat vertical scrolling.

The one deliberate compromise: the totality body copy scrubs down to 35% opacity
at the eclipse itself and comes straight back. It is fully legible before and
after, and reduced-motion users never see it.

---

## Single-file build

`vite.config.single.ts` produces one self-contained JS bundle in `dist-single/`
for hosts that can't serve sibling asset files:

```bash
npx vite build --config vite.config.single.ts
```

Inline `dist-single/app.css` and `dist-single/app.js` into a page with a
`<div id="root">` and it runs with no requests but the two Google fonts. Escape
`</script` as `<\/script` in the JS when you inline it.

---

## Swapping in a real GLTF bottle

The bottle is procedural on purpose — a lathe-turned coin profile with filleted
rims plus an off-axis gold disc, in `src/three/Bottle.tsx`. When a real model
gets made:

1. Drop the `.glb` in `public/` and replace the two `<mesh>` blocks in `Bottle.tsx`
   with `const { nodes } = useGLTF('/bottle.glb')`, keeping the materials or
   using the ones baked into the file. Wrap the canvas contents in `<Suspense>`
   — they already are.
2. **Keep the dimensions in the `BOTTLE` constant truthful**, or model to them.
   `radius`, `halfHeight`, `capRadius`, `capOffsetX` and `capY` are what the
   eclipse occlusion in `choreography.ts` is solved against, and `CoronaGlow`
   positions itself from `capOffsetX` / `capY`. If the real bottle is a
   different shape, redo the arithmetic in the block comment at the top of
   `choreography.ts` — it's four lines of geometry.
3. Call `useGLTF.preload('/bottle.glb')` at module scope and give the `Suspense`
   fallback something better than `null` if the file is large.

Nothing else in the scene knows or cares what the bottle is made of.

---

## Layout

```
src/
  three/
    Experience.tsx    Canvas, quality tiers, PerformanceMonitor
    Stage.tsx         lights, environment, and the single frame loop
    choreography.ts   camera poses as a pure function of (phase, progress)
    Bottle.tsx        procedural lathe geometry + the gold cap
    CoronaGlow.tsx    the eclipse rim (billboarded additive shader)
    CoronaRing.tsx    the transmission ring, mounted on demand
    Backdrop.tsx      sky luminance
    Effects.tsx       bloom, vignette, grain, ACES
  components/         one file per section, plus nav / cursor / footer
  lib/                scroll store, section progress, magnetic, media queries
```
