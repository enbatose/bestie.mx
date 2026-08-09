---
name: bestie-mark-highfive
description: >-
  Recreates the Bestie brand-mark high-five animation (two people silhouettes,
  arms raise, clap sparks) in classic or colorful variants. Use when animating
  the Bestie mark, high-five logo, people lockup, clap sparks, HeroAnimatedLockup
  motion, Facebook Promise slide mark décor, or seek-driven frame capture of the
  mark SVG. Ask which color variant if the user does not specify.
---

# Bestie mark high-five animation

Canonical sequence for the **two-people brand mark**: bodies settle → arms raise → clap grows.

**Always confirm the color variant** if the user did not name one: **classic** (default on product) or **colorful** (Promise slide in publisher motion).

**Product (CSS):** `src/components/HeroAnimatedLockup.tsx`, `GdlHeroAnimatedLockup.tsx` + `src/index.css` (`.home-logo-*`) — **classic**.  
**Raster / Facebook motion Promise:** seek-driven — current ship uses **colorful**; reference `public/brand/facebook/post-gdl-publishers-hi5.mp4`.

Related: [`bestie-url-lockup`](../bestie-url-lockup/SKILL.md); [`fb-motion-gif`](../fb-motion-gif/SKILL.md).

## Color variants

Stroke weight is always `2.5` in mark viewBox space. Forest stage bg: `#143D30`.

### Classic (original / product default)

| Element | Color |
| --- | --- |
| Left person (head, body, legs, high-five arm) | `#FFFFFF` |
| Right person (head, body, legs, high-five arm) | `#FFFFFF` |
| Clap sparks (all 3 rays) | `#84CC16` |

Use when the user says **classic**, **original**, **all white**, **product**, or **site lockup**.

### Colorful (split people + tri-color clap)

| Element | Color |
| --- | --- |
| Left person (incl. high-five arm) | `#FFFFFF` |
| Right person (incl. high-five arm) | `#84CC16` |
| Clap left ray `M30 6L33 1` | `#FFFFFF` |
| Clap middle ray `M37 6V0` | `#84CC16` |
| Clap right ray `M44 6L41 1` | `#FFFFFF` |

Use when the user says **colorful**, **lime right**, **split colors**, or asks for the **Promise slide** mark look.

Clap markup for colorful (per-path strokes; do not set one stroke on the parent `<g>`):

```svg
<g transform="translate(-37 -3)" stroke-width="2.5" stroke-linecap="round">
  <path d="M30 6L33 1" stroke="#FFFFFF"/>
  <path d="M37 6V0" stroke="#84CC16"/>
  <path d="M44 6L41 1" stroke="#FFFFFF"/>
</g>
```

Classic clap keeps a single parent `stroke="#84CC16"` on that group.

Static Hook **footer** mark already uses left white / right lime with **all-lime** clap — that is not the colorful animated clap; don’t confuse the two.

## Beat timeline (local ms from mark start)

Same for both variants. Total settle ≈ **1.55 s** (`HIGH_FIVE_DONE_MS = 1550`).

| t (ms) | Beat | Motion |
| --- | --- | --- |
| 0 → 500 | Left person in | opacity 0→1, `translateX(-6px→0)` |
| 80 → 580 | Right person in | same, delayed **80ms**, from `+6px` |
| 0 → 550 | Arms hold down | left `rotate(92deg)`, right `rotate(-92deg)` at shoulder pivots |
| 550 → 1250 | Arms raise | 700ms; overshoot then settle to `0deg` |
| 1200 → 1550 | Clap grow | opacity 0→1, scale `0.15→1` |

Easing (match product CSS):

| Beat | Curve |
| --- | --- |
| Person in | `cubic-bezier(0.22, 1, 0.36, 1)` ≈ ease-out |
| Arm raise | `cubic-bezier(0.34, 1.2, 0.64, 1)` (slight overshoot) |
| Clap | `cubic-bezier(0.22, 1.35, 0.36, 1)` |

Arm keyframe shape (left; right mirrors signs):

```
0%   rotate(92deg)    // down at side
70%  rotate(-4deg)    // overshoot past up
100% rotate(0deg)     // settled high-five
```

## SVG structure

ViewBox `0 0 74 74`. Inner content:

```svg
<g transform="matrix(0.65 0 0 0.65 13 18)">
  <!-- people + arms + clap -->
</g>
```

### Layers

1. **Left person** — head, torso, outer stub, legs (+ nested arm for capture).  
2. **Right person** — mirrored (+ nested arm).  
3. **High-five arms** — pivot at shoulder.  
4. **Clap** — three rays (colors per variant).

### Shoulder pivots (required)

```svg
<!-- Left arm -->
<g transform="translate(24 27)">
  <g class="arm-left" style="transform-origin: 0px 0px">
    <path transform="translate(-24 -27)" d="M24 27C28 21 32 14 37 10" … />
  </g>
</g>

<!-- Right arm -->
<g transform="translate(50 27)">
  <g class="arm-right" style="transform-origin: 0px 0px">
    <path transform="translate(-50 -27)" d="M50 27C46 21 42 14 37 10" … />
  </g>
</g>
```

Clap pivots at `(37, 3)` the same way.

Copy exact person path `d` from `HeroAnimatedLockup.tsx` / `GdlHeroAnimatedLockup.tsx`.

## Implementation A — product CSS (live site)

**Classic only** today (both people white; clap all lime). Classes in `src/index.css`:

| Class | Role |
| --- | --- |
| `.home-logo-person--left` / `--right` | Person fade + slide |
| `.home-logo-arm--left` / `--right` | Arm raise (`both` fill) |
| `.home-logo-clap` | Sparks grow |
| `.home-logo-wordmark` | Optional wordmark fade |

Prefer reusing `HeroAnimatedLockup` / `HeroMarkOnly`.  
`prefers-reduced-motion: reduce` → settled mark, no motion.

To ship **colorful** on the site later: set right-person + right-arm strokes to `#84CC16` and split clap path strokes as above — keep the same keyframes.

## Implementation B — seek-driven (frame capture / Facebook)

Drive from `__seek(ms)` (CSS animation clocks are non-deterministic under Playwright):

```js
function setHi5(localMs) {
  // person opacity + translateX (left 0–500ms, right 80–580ms)
  // arms: rotate 92/-92 until 550ms, then ease to 0 over 700ms
  // clap: hidden until 1200ms, then scale/opacity over 350ms
}
```

### Hard rule: arms stay attached

For capture builds, nest each arm **inside** its person `<g>` so opacity/translate apply together.

```svg
<g id="pLeft">
  <!-- head, body, legs -->
  <g transform="translate(24 27)">…armLeft…</g>
</g>
<g id="pRight">
  <!-- … -->
  <g transform="translate(50 27)">…armRight…</g>
</g>
```

## Size / placement (1080² Promise slide)

| Item | Guide |
| --- | --- |
| Mark box | ~280×280px |
| Stack | Offer line above mark; gap ~20–28px |
| Start | Local `t=0` when Promise layer is active |
| Current Promise ship | **Colorful** variant |

## QA checklist

- [ ] Correct **variant** (classic vs colorful) per request
- [ ] Bodies appear with arms (no floating arm-only frame)
- [ ] Arms start **down**, then raise
- [ ] Classic: clap all lime · Colorful: clap white / lime / white
- [ ] Colorful: right silhouette + its arm are lime
- [ ] Sequence done by ~1.55s
- [ ] Capture path: `__seek` only

## Source map

| Need | Where |
| --- | --- |
| Full lockup (classic) | `src/components/HeroAnimatedLockup.tsx` |
| Mark-only + GDL flip | `src/components/home/GdlHeroAnimatedLockup.tsx` |
| Keyframes / timing | `src/index.css` (`.home-logo-*`) |
| FB motion reference | `public/brand/facebook/post-gdl-publishers-hi5.mp4` |
