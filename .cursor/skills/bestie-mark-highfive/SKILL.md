---
name: bestie-mark-highfive
description: >-
  Recreates the Bestie brand-mark high-five animation (two people silhouettes,
  arms raise, lime clap sparks). Use when animating the Bestie mark, high-five
  logo, people lockup, clap sparks, HeroAnimatedLockup motion, Facebook Promise
  slide mark décor, or seek-driven frame capture of the mark SVG.
---

# Bestie mark high-five animation

Canonical sequence for the **two-people brand mark**: bodies settle → arms raise → lime clap grows.

**Product (CSS):** `src/components/HeroAnimatedLockup.tsx`, `GdlHeroAnimatedLockup.tsx` + `src/index.css` (`.home-logo-*`).  
**Raster / Facebook motion:** seek-driven twin of the same timing (see below) — reference `public/brand/facebook/post-gdl-publishers-hi5.mp4`.

Related: [`bestie-url-lockup`](../bestie-url-lockup/SKILL.md) for `bestie.mx` text; [`fb-motion-gif`](../fb-motion-gif/SKILL.md) for Feed specs.

## Colors

| Element | Color |
| --- | --- |
| People (heads, bodies, legs, arms) | `#FFFFFF` stroke |
| Clap sparks (3 short rays) | `#84CC16` stroke |
| Stroke weight | `2.5` in mark viewBox space |
| Typical stage bg | `#143D30` (forest) |

## Beat timeline (local ms from mark start)

Total settle ≈ **1.55 s** (`HIGH_FIVE_DONE_MS = 1550`).

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

ViewBox `0 0 74 74`. Inner content scaled with:

```svg
<g transform="matrix(0.65 0 0 0.65 13 18)">
  <!-- people + arms + clap -->
</g>
```

### Layers

1. **Left person** — head circle, torso U-path, outer arm stub, two legs.  
2. **Right person** — mirrored.  
3. **High-five arms** — one path each; **pivot at shoulder**.  
4. **Clap** — three lime rays above the meet point.

### Shoulder pivots (required)

Arms rotate around the shoulder, not the path midpoint:

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

Clap group pivots at `(37, 3)` the same way (translate → rotate/scale origin → untranslate).

Copy exact person path `d` attributes from `HeroAnimatedLockup.tsx` / `GdlHeroAnimatedLockup.tsx` — do not redraw freehand.

## Implementation A — product CSS (live site)

Classes in `src/index.css`:

| Class | Role |
| --- | --- |
| `.home-logo-person--left` / `--right` | Person fade + slide |
| `.home-logo-arm--left` / `--right` | Arm raise (`animation-fill-mode: both`) |
| `.home-logo-clap` | Lime sparks grow |
| `.home-logo-wordmark` | Optional wordmark fade (lockup only) |

Prefer reusing `HeroAnimatedLockup` / `HeroMarkOnly` instead of duplicating SVG.

`prefers-reduced-motion: reduce` → kill animations; show final settled mark.

## Implementation B — seek-driven (frame capture / Facebook)

CSS `animation` is **non-deterministic** under Playwright screenshot loops. Drive transforms from `__seek(ms)`:

```js
function setHi5(localMs) {
  // person opacity + translateX (left 0–500ms, right 80–580ms)
  // arms: rotate 92/-92 until 550ms, then ease to 0 over 700ms
  // clap: hidden until 1200ms, then scale/opacity over 350ms
}
```

### Hard rule: arms stay attached

Arms must **fade/slide with their body**. Otherwise full-opacity arms show before silhouettes.

**Do this for capture builds:** nest each arm group **inside** its person `<g id="pLeft|pRight">` so `opacity` / `translateX` on the person applies to the arm.

```svg
<g id="pLeft">
  <!-- head, body, legs -->
  <g transform="translate(24 27)">…armLeft…</g>
</g>
```

Product CSS can keep arms in a sibling `.home-logo-highfive` group (arms use `both` fill at down pose while people fade). For **raster motion**, always nest.

## Size / placement (1080² Promise slide)

| Item | Guide |
| --- | --- |
| Mark box | ~280×280px |
| Stroke | white on forest; clap lime |
| Stack | Offer line above mark; gap ~20–28px |
| Start | Local `t=0` when Promise layer is active |

## QA checklist

- [ ] Bodies appear before/with arms (no floating arm-only frame)
- [ ] Arms start **down**, then raise (not already up on first visible frame)
- [ ] Clap is lime `#84CC16`, grows after arms nearly meet (~1.2s)
- [ ] Sequence completes by ~1.55s
- [ ] Reduced-motion / end state: arms up + clap visible (product)
- [ ] Capture path: `__seek` only — no reliance on CSS animation clocks

## Source map

| Need | Where |
| --- | --- |
| Full lockup (mark + wordmark) | `src/components/HeroAnimatedLockup.tsx` |
| Mark-only + GDL flip | `src/components/home/GdlHeroAnimatedLockup.tsx` |
| Keyframes / timing | `src/index.css` (`.home-logo-*`) |
| FB motion reference | `public/brand/facebook/post-gdl-publishers-hi5.mp4` |
