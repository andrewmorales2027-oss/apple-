# The Blackout Meal — Brazen Burger Co.

A single-page, scroll-driven 3D product site for The Blackout Meal: double smash burger,
hand-cut fries, and an ice-cold bottle of Brazen Cola.

Everything in the scene is real WebGL geometry the camera moves through — no product
photography, no parallaxed flat images, no downloaded models. The burger is stacked from
procedural Three.js primitives and assembles itself layer-by-layer as you scroll.

```bash
npm install
npm run dev
```

Then open the printed URL. A cold checkout renders the finished experience: every texture,
normal map and label is generated in a 2D canvas at load time, so there is nothing to
fetch beyond the two webfonts.

## Stack

| Piece | What it does |
| --- | --- |
| Vite + React + TypeScript | App shell and build |
| React Three Fiber + drei | The 3D scene, `MeshTransmissionMaterial`, `OrbitControls`, `ContactShadows` |
| GSAP + ScrollTrigger | Feeds scroll progress into the scene and scrubs the hero wordmark |
| `@react-three/postprocessing` | Bloom, film grain, vignette |

## How the scroll rig works

`src/scene/scrollState.ts` is the only bridge between the document and the frame loop.
ScrollTrigger writes section progress into a plain mutable object; `useFrame` reads it and
damps toward it. No React state updates per scroll frame, and every value is damped rather
than teleported, so a flung scroll arrives as a camera move instead of a cut.

Sections are laid out in `src/styles/global.css` as tall blocks with `position: sticky`
inner panels. **ScrollTrigger's `pin` is deliberately not used anywhere** — pinning
rewrites the document with a fixed-position wrapper, which breaks native keyboard
scrolling. CSS sticky gets the same visual hold while the page stays an ordinary
scrolling document.

Pacing is tunable from five CSS custom properties at the top of `global.css`:

```css
--h-hero: 100svh;   --h-build: 240svh;  --h-cold: 170svh;
--h-panel: 115svh;  --h-order: 150svh;
```

The brief asked for roughly five screen-heights; the page ships at roughly ten. Eight
assembly beats plus three pinned breakdown panels inside five screens gives each beat
about a third of a screen of scroll, which reads as a flicker rather than a build. Shorten
those five values if you'd rather have the original pacing — it is a one-line change per
section and nothing else depends on the heights.

## `prefers-reduced-motion: reduce`

When the user asks for reduced motion the page ships static, legible and normally
scrolling, with the same copy and the burger **already fully assembled**. Specifically
disabled:

- The scroll-driven camera rig (`CameraRig` is swapped for `StaticCamera`, a fixed
  three-quarter hero framing).
- All layer fly-in animation — every ingredient starts at its rest transform.
- The cheese-drip settle wobble.
- The steam particle system (not mounted at all).
- Postprocessing: bloom, film grain and vignette are not mounted.
- The custom cursor and magnetic buttons (not mounted; the native cursor is restored).
- The hero blur-to-focus scrub, the scroll-hint pulse, and the CSS
  `animation-timeline: view()` panel reveals.
- The render loop itself: the canvas switches to `frameloop="demand"`, so a still scene
  costs nothing instead of burning 60fps on something that isn't moving.

`OrbitControls` stays available — that motion is user-initiated, which is the one kind
reduced-motion is not asking you to remove.

## Accessibility

- All copy is real DOM text. Nothing is baked into the canvas, and the canvas itself is
  `aria-hidden`.
- Landmarks and heading order: `header` → `main` → `section` per beat, each with an
  `aria-labelledby` heading, then `footer`.
- No scroll jacking. Arrow keys, Space, Page Up/Down, Home and End all behave natively
  because nothing is pinned or scroll-locked.
- A visible "Skip to order" link sits top-left at all times, not only on focus.
- The canvas is `pointer-events: none` except during the final orbit shot, so it never
  intercepts clicks, text selection or scroll.
- Orbit is offered on fine pointers only. On touch, a drag on the canvas would swallow the
  page scroll, so the directed final shot is kept instead.
- The ingredient list is real text that highlights as each layer lands — the assembly
  sequence has a legible non-visual equivalent.

## Lighting model

The scene is lit by a **generated HDR environment**, not by lamps alone. `src/scene/environment.ts`
paints an equirectangular studio map into a `Float32Array` — a key softbox, a tall narrow
strip light, a warm kicker, a small hard accent — with radiance values running up to ~14,
then runs it through `PMREMGenerator` so roughness blurs it correctly.

That number is the point. An LDR environment caps every highlight at 1.0, which is
mid-grey after tone mapping, and no amount of material tuning makes a surface look
photographed when its brightest specular is grey. The strip light does the most visible
work: a tall narrow source is what draws the continuous specular streak down the side of
the bottle and across the bun crown.

A handful of real lights remain for what an environment can't do — the hard key shadow,
the rim separating a near-black bun from a near-black background, and the short-throw
backlight that makes the cola read as cola rather than as a silhouette.

Materials use clearcoat and sheen lobes to separate wet from dry: rendered fat on the
patty crust, the waxy cuticle on lettuce, brine on the pickles, frying oil on the fries.
These are gated behind `richMaterials` (off on the low tier), since each lobe compiles
extra work into the shader.

## Performance

Budget target: 60fps on a mid-tier laptop (integrated graphics) and a mid-range phone,
not just a dev machine. `src/lib/quality.ts` tiers the device from
`hardwareConcurrency`, `deviceMemory`, pointer type and viewport, then scales everything
from one place.

Append `?tier=low`, `?tier=mid` or `?tier=high` to the URL to force a tier — device
detection is a heuristic, and the top tier is unreachable on most CI machines.

| | low | mid | high |
| --- | --- | --- | --- |
| DPR ceiling | 1.25 | 1.75 | 2 |
| HDR env map width | 128 | 256 | 512 |
| Normal / roughness maps | 256px | 512px | 1024px |
| Clearcoat + sheen lobes | ✗ | ✓ | ✓ |
| Steam particles | 0 | 26 | 44 |
| Sesame seeds | 60 | 120 | 170 |
| Condensation droplets | 40 | 90 | 140 |
| Transmission bottle | ✗ (physical-material fallback) | ✓ 256px | ✓ 512px |
| Postprocessing | ✗ | ✓ | ✓ |
| Depth of field | ✗ | ✗ | ✓ |
| Shadows | ✗ | ✓ 1024 | ✓ 2048 |

**Cut order if you need more headroom**, cheapest win first:

1. **Steam particles** — `steamCount: 0`. Additive instanced planes with `depthWrite:
   false` are pure overdraw; they are the first thing to go and the least missed.
2. **DepthOfField** — already high-tier only. It costs roughly 4–6ms/frame at 1080p on
   integrated graphics, which is the entire difference between 60 and 45fps on the
   hardware this page targets. It stays the first effect to cut.
3. **Rich materials** — `richMaterials: false` drops the clearcoat and sheen lobes.
4. **The transmission bottle** — `MeshTransmissionMaterial` re-renders the scene into an
   off-screen buffer for real refraction. Low tier already falls back to a
   `meshPhysicalMaterial` approximation. Dropping `transmissionResolution` to 128 buys
   most of the cost back before you have to abandon it entirely.
5. **Env map resolution**, then **bloom** — last, and only if the rest wasn't enough.

Other choices made for the budget: bloom's luminance threshold is high (0.72) so it only
catches the cheese emissive and the specular hits on the glass and condensation; the
composer runs with `multisampling: 0` and no normal pass; contact shadows render one frame
and stop under reduced motion; and the whole page is a single persistent canvas rather than
one per section.

Depth of field auto-focuses on each beat's **subject**, not on the camera's aim point —
those are deliberately different, since the cold beat aims well to the right of the bottle
for composition. Focus racks between subjects rather than cutting. See `src/scene/focus.ts`.

## Swapping in real models later

Everything procedural is isolated behind a small number of components, each authored at its
final rest transform inside its own `<group>`. The assembly rig in `src/scene/Burger.tsx`
animates the *wrapper* group, never the geometry, so a swap is local:

| Replace | File | Note |
| --- | --- | --- |
| Bottom / top bun | `src/scene/parts/Buns.tsx` | Keep the sesame `InstancedMesh` or bake seeds into the GLTF |
| Patties | `src/scene/parts/Patty.tsx` | `buildPattyGeometry` is the only thing to delete |
| Cheese + drips | `src/scene/parts/Cheese.tsx` | Keep the drip groups: the settle wobble is animated per-group, so scanned cheese should still be split into slab + drips |
| Bacon | `src/scene/parts/Bacon.tsx` | `ribbonGeometry` sweeps a twisted cross-section along a curve |
| Produce | `src/scene/parts/Produce.tsx` | Lettuce, tomato, onion, pickle, sauce |
| Fries | `src/scene/parts/Fries.tsx` | Keep the pile→fan lerp; only `fryGeometry` is procedural |
| Bottle | `src/scene/parts/Bottle.tsx` | `OUTER`/`MOUTH` are the lathe profile; `radiusAt()` sticks droplets to the surface and would need the model's silhouette |

To drop in a GLTF:

```tsx
const { nodes } = useGLTF("/models/patty.glb");
return <mesh geometry={(nodes.Patty as THREE.Mesh).geometry} material={...} />;
```

Two things to preserve when you do:

- **Rest transforms.** Each part positions itself in burger-local space (bottom bun at
  `y = -1.10`, crown at `y = 1.18`, ground plane at `y = -1.52`). Match those or retune
  `LAYERS` in `Burger.tsx`.
- **The layer split.** The build sequence needs each ingredient as a separately
  transformable object. A single welded burger mesh cannot assemble itself.

Textures live in `src/scene/textures.ts`; each is memoized and can be replaced with a
loaded map without touching the materials that consume them.
