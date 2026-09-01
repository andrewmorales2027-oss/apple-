# `scroll-locked-video-hero` — integration guide

A dependency-free React hero that pins the page and scrubs a `<video>` with wheel /
touch input instead of scrolling. Ships as `components/ui/scroll-locked-video-hero.tsx`.

---

## 1. This repository does not yet support the component

The component is a `.tsx` client component using the `@/` import alias. This repo is
currently a single static page:

```
index.html          # United Collision Center landing page (hand-written HTML/CSS/JS)
skills-lock.json
.agents/ .claude/
```

There is **no** `package.json`, `tsconfig.json`, `tailwind.config.*`, or
`components.json`. There is no React, no bundler, and no `@/*` path alias, so
`components/ui/scroll-locked-video-hero.tsx` will not compile or resolve as-is.

Set up a project first (§2), or port the technique to vanilla JS (§5).

---

## 2. Creating a project that can host it

### 2a. New app (recommended)

`shadcn init` scaffolds Next.js + TypeScript + Tailwind + the `@/*` alias in one step:

```bash
npx shadcn@latest init
```

Answer the prompts (Next.js, TypeScript **yes**, your base colour, CSS variables
**yes**). It writes `components.json`, `tailwind.config.ts` (or `@theme` in
`app/globals.css` for Tailwind v4), `lib/utils.ts`, and the `@/*` alias in
`tsconfig.json`.

Then drop the two files from this repo into place:

```bash
cp components/ui/scroll-locked-video-hero.tsx      <new-app>/components/ui/
cp components/ui/scroll-locked-video-hero.demo.tsx <new-app>/components/ui/
```

### 2b. Adding to an existing JS project

```bash
# TypeScript
npm i -D typescript @types/react @types/react-dom
npx tsc --init

# Tailwind (v4)
npm i tailwindcss @tailwindcss/postcss postcss
# then add `@import "tailwindcss";` to your global stylesheet

# shadcn structure + aliases
npx shadcn@latest init
```

### 2c. The `@/*` alias

`demo.tsx` imports `@/components/ui/scroll-locked-video-hero`. That alias is not
built into TypeScript — it must be declared in `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",                    // TypeScript 5.x
    "paths": { "@/*": ["./*"] }
  }
}
```

**TypeScript 7 removed `baseUrl`** (`error TS5102`). On TS 7, drop it — `paths` is
resolved relative to the `tsconfig.json` directly:

```jsonc
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```

Vite users also need the matching resolver in `vite.config.ts`
(`resolve.alias` or `vite-tsconfig-paths`); Next.js reads `tsconfig.json` directly.

---

## 3. Why the component belongs in `components/ui/`

`components/ui/` is not cosmetic — it is the contract every shadcn tool relies on:

- **`components.json` points at it.** The `aliases.ui` field (default
  `@/components/ui`) is where `npx shadcn add <component>` writes files. Put the
  component elsewhere and the CLI installs its dependencies to a different folder,
  producing two parallel component trees.
- **Registry components import each other by that path.** A shadcn component that
  needs `Button` emits `import { Button } from "@/components/ui/button"`. If that
  path is wrong, every generated file needs hand-editing after install.
- **It separates primitives from product code.** `components/ui/` holds
  unopinionated, reusable pieces you may re-sync from the registry;
  `components/` (or `app/`) holds the composed, app-specific screens. Mixing them
  means a future `shadcn add` can silently overwrite your business logic.
- **It is where tooling looks.** Codemods, `shadcn diff`, and most Tailwind
  `content` globs assume it.

If your project's UI directory is something else, keep it consistent by updating
`aliases.ui` in `components.json` rather than moving files ad hoc.

---

## 4. Usage

```tsx
import MetroHero from "@/components/ui/scroll-locked-video-hero"

export default function Page() {
  return <MetroHero />
}
```

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `videoSrc` | `string` | bundled subway clip | See §4a — self-host this. |
| `title` | `string` | `"THE CITY OPENS"` | Blurs out over the first 35% of the scrub. |
| `scrollHint` | `string` | `"SCROLL"` | Hidden once input begins. |
| `tagline` | `string` | `"Every door…"` | Focuses in over the last 18%. |
| `signature` | `{ name, url } \| false` | author credit | Pass `false` to remove. |
| `scrubDistance` | `number` | `3200` | Input px needed for the full video. |
| `className` / `style` | — | — | Applied to the outer section. |

### 4a. Host the video yourself

The default `videoSrc` is a `raw.githubusercontent.com` URL. That host sends
`Content-Type: text/plain`, does not support HTTP range requests reliably, and is
rate-limited — all three break `currentTime` seeking, which is the entire effect.
Serve the file from `/public` or a CDN instead:

```tsx
<MetroHero videoSrc="/video/city-opens.mp4" />
```

For smooth scrubbing the file also needs a **short keyframe interval**. Re-encode
with a keyframe every frame or two:

```bash
ffmpeg -i source.mp4 -c:v libx264 -crf 23 -g 2 -keyint_min 2 \
       -movflags +faststart -an public/video/city-opens.mp4
```

Without this, seeking snaps between distant keyframes and the scrub stutters.

---

## 5. Known issues in the shipped component

The file is committed as supplied except for one required compile fix (§5.0).
Three further defects are worth knowing about before you put it in front of users;
patches are given so you can decide.

### 5.0 Strict-mode compile error — **fixed in the committed file**

As supplied, the component does not compile. Verified failing on both TypeScript
5.9.3 and 7.0.2 under `strict` (which every `shadcn init` project enables):

```
components/ui/scroll-locked-video-hero.tsx(104,7): error TS18047: 'video' is possibly 'null'.
```

`const video = videoRef.current` is narrowed to non-null by the
`if (!video || !section) return` guard, but `seekTo` was a **hoisted `function`
declaration**, and TypeScript discards narrowing inside those — it cannot prove a
hoisted function is not called before the guard runs. The sibling `onSeeked`
handler touches `video` too and does *not* error, because it is an arrow function
assigned to a `const`, created after the narrowing.

The fix, applied here, is to match that form. No runtime behaviour changes —
`seekTo` is only ever called from `frame()`, which first runs on the
`requestAnimationFrame` scheduled further down:

```diff
-    function seekTo(t: number) {
+    const seekTo = (t: number) => {
       if (isSeeking) {
         pendingTime = t
         return
       }
       isSeeking = true
       video.currentTime = t
-    }
+    }
```

Both the component and the demo now typecheck clean on TS 5.9 and TS 7.

### 5.1 The page lock is permanent — the visitor can never leave

`engageLock()` runs unconditionally on mount and is only undone by the effect's
cleanup, so `document.body` stays `position: fixed` and `wheel`/`touchmove` stay
`preventDefault`ed for as long as the component is mounted. Reaching the end of the
video does nothing: `targetProgress` clamps at `1` and the listeners keep swallowing
input. Nothing below the hero is reachable by scrolling, and the in-file comment
says as much ("there is no release valve in either direction").

This directly contradicts the header comment, which promises the opposite: *"Once
the video reaches the end and the user keeps pushing forward, the page unlocks and
continues normally — and re-locks if they scroll back up into it."*

To get the documented behaviour, let overshoot past either end fall through to the
page instead of being consumed:

```diff
-    function addDelta(deltaY: number) {
-      const next = clamp(targetProgress + deltaY / scrubDistance, 0, 1)
-      targetProgress = next
-      if (targetProgress > 0.001) hasStartedScrolling = true
-      return true
-    }
+    // Returns false when the gesture overshoots an end — the caller then lets
+    // the event through so the page takes over.
+    function addDelta(deltaY: number) {
+      const raw = targetProgress + deltaY / scrubDistance
+      targetProgress = clamp(raw, 0, 1)
+      if (targetProgress > 0.001) hasStartedScrolling = true
+      return raw >= 0 && raw <= 1
+    }
 
     const onWheel = (e: WheelEvent) => {
-      addDelta(e.deltaY)
-      e.preventDefault()
+      const consumed = addDelta(e.deltaY)
+      if (consumed) {
+        e.preventDefault()
+      } else {
+        releaseLock()
+      }
     }
```

…and re-`engageLock()` from an `IntersectionObserver` on `sectionRef` when the hero
scrolls back into view. Apply the same `consumed` check in `onTouchMove`.

### 5.2 Reduced-motion users are locked out with no feedback

When `prefers-reduced-motion: reduce` matches, the rAF loop never starts — but the
body lock and the `preventDefault`ing listeners are still installed. The result is a
page that cannot scroll and a video that never moves: a hard trap with no way out
short of a reload. Skip the lock entirely in that branch:

```diff
-    engageLock()
+    if (!reduceMotion) engageLock()
```

```diff
-    window.addEventListener("wheel", onWheel, { passive: false })
-    window.addEventListener("touchstart", onTouchStart, { passive: true })
-    window.addEventListener("touchmove", onTouchMove, { passive: false })
+    if (!reduceMotion) {
+      window.addEventListener("wheel", onWheel, { passive: false })
+      window.addEventListener("touchstart", onTouchStart, { passive: true })
+      window.addEventListener("touchmove", onTouchMove, { passive: false })
+    }
```

The existing `onLoadedData` branch already parks the video at 92% for these users,
so they get the final frame and a normally scrolling page.

### 5.3 Smaller notes

- **Keyboard and scrollbar input are not captured.** `PageDown`, `Space`, arrow keys
  and scrollbar drags bypass the wheel handler. With the body pinned they simply do
  nothing, which leaves keyboard-only users stuck. Add a `keydown` handler mapping
  those keys through `addDelta` if you keep the lock.
- **`section` is read but unused** beyond the null guard — it becomes meaningful only
  once you add the `IntersectionObserver` from §5.1.
- **iOS Safari still rubber-bands** the fixed body on some versions; add
  `overscroll-behavior: none` on `html, body` alongside the lock.

---

## 6. Using it in *this* repo's static page instead

`index.html` is hand-written HTML/CSS/JS with its own design tokens. If the goal is
that page rather than a new React app, the technique ports directly — the React
parts are only `useRef` and `useState`:

- refs → `document.querySelector`
- `ready` state → a class toggle on the `<video>`
- the `useEffect` body → an IIFE in the existing `<script>`
- inline styles → a `<style>` block using the page's existing custom properties
  (`--bg`, `--ink`, `--accent`, `--ease-out`)

The wheel/touch handling, the `isSeeking`/`pendingTime` seek queue, and the `0.18`
lerp all carry over unchanged.

**That port is done: [`scroll-hero.html`](../scroll-hero.html)** — open it in a
browser, no build step. It is the same effect with the §5 defects fixed:

- the lock releases when a gesture overshoots the end, and re-engages via
  `IntersectionObserver` when you scroll back up into the hero;
- `prefers-reduced-motion` skips the lock and the input capture entirely;
- arrows / `Page Up` / `Page Down` / `Space` / `Home` / `End` scrub while locked,
  and a *Skip intro* button is a visible escape hatch;
- `seekTo` no longer re-seeks when the value hasn't moved (the naive version fires
  a seek every rAF tick at rest — measured ~64/sec of pure decoder churn).

Verified in Chromium: locked at rest, forward scrub 0→4.5s, backward scrub
4.5→1.5s, release at the end, normal page scroll, re-lock on return, and backward
scrub again after re-lock.

To use it as this site's hero, its markup and script move into `index.html` and the
inline styles swap to the page's existing tokens (`--bg`, `--ink`, `--accent`,
`--ease-out`). Note the hero currently there is a text + CTA layout carrying the
business's headline, phone CTA and trust badges — a full-bleed locked video would
displace all of it, so that swap is a content decision, not just a code one.
