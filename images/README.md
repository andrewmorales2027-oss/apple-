# Photographs

The site is wired for the five files below. Drop them in this folder with these
**exact names** and they appear automatically — no code changes needed.

Until a file is present, its slot falls back to the illustration it replaces,
and the two photo-only sections stay out of the page entirely. Nothing breaks
while a photo is missing.

| Filename | What it is | Where it appears |
| --- | --- | --- |
| `lotus-555-rear.jpg` | Orange Lotus Elise, rear three-quarter, in the shop | Hero, right column |
| `shop-floor.jpg` | Workshop floor, wide, cars in progress | Full-bleed band under the hero |
| `cobra.jpg` | Dark red AC Cobra replica in the lot | 3D gallery, card 1 |
| `lotus-555-detail.jpg` | Lotus front wheel arch, close | 3D gallery, card 2 |
| `bmw-damage.jpg` | White BMW 3 Series, front-end damage | 3D gallery, card 3 |

## Before you drop them in

- **Landscape, roughly 16:9**, except `bmw-damage.jpg` which is near square.
  Anything close works — the CSS crops with `object-fit: cover`.
- **Around 2000px on the long edge.** Bigger is wasted; smaller goes soft on
  retina screens.
- **Save as JPEG at quality 80.** Aim for under 400KB each.
- The `width`/`height` attributes in `index.html` are set to the dimensions of
  the originals. If yours differ noticeably, update them so the page doesn't
  shift while images load.

## Captions

The gallery captions in `index.html` describe only what is visible in each
photo. Replace them with the real story of each car — make, model, and what was
actually done — and they get considerably more persuasive.

## Still missing

A genuine **before/after pair**: the same car, same angle, same distance, shot
at intake and at completion. The "See the difference" slider is built and
waiting for one, and is currently showing illustrations. This is the single
highest-value pair of photographs the site could have.
