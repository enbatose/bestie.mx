---
name: bestie-url-lockup
description: >-
  Renders the Bestie brand URL lockup `bestie.mx` with correct colors and a lime
  i-dot (dotless ı + overlay tittle). Use when drawing bestie.mx as flat HTML/CSS
  text in Facebook creatives, motion GIFs/MP4s, posters, landing copy lockups, or
  any marketing surface that needs the lime i-dot wordmark (not only the SVG logo).
---

# Bestie URL lockup (`bestie.mx`)

Canonical recipe for **flat text** `bestie.mx` with a **lime i-dot**, as shipped in
`public/brand/facebook/post-gdl-publishers-hi5.mp4`.

For motion sequencing / Feed specs, also read [`fb-motion-gif`](../fb-motion-gif/SKILL.md).
For the official path-based logo on the product site, prefer the SVG wordmark
(`HeroWordmarkOnly` in `GdlHeroAnimatedLockup.tsx`) — same colors, different craft.

## Color tokens (required)

| Role | Hex | Where it goes |
| --- | --- | --- |
| Forest (bg / dark text) | `#143D30` | Creative background; badge text on white pills |
| Lime (accent) | `#84CC16` | **i-dot**, **`mx`**, accents (`gratis`, `tu bestie.`, mark sparkles) |
| White | `#FFFFFF` | Letters `b` `e` `s` `t` `e` of `bestie`, and the **`.`** before `mx` |
| Soft white (optional) | `rgba(255,255,255,.82)` | Proof / secondary lines only — never the URL |

### URL color split (do not invent variants)

```
bestie . mx
^^^^^ ^ ^^
white | lime
      white period
+ lime tittle on the i
```

- `best` + stem of `i` + `e` → **white**
- i-dot (tittle) → **lime `#84CC16`**
- `.` → **white** (not lime)
- `mx` → **lime `#84CC16`**

Lowercase only: `bestie.mx` (never `Bestie.mx` in this lockup).

## HTML / CSS recipe (flat text)

### Markup

Use **dotless i** `ı` (`&#305;` / U+0131) so there is no native white tittle, then paint the lime circle.

```html
<span class="brand-text">
  best<span class="i-lime">&#305;<span class="tittle" aria-hidden="true"></span></span>e<span class="period">.</span><span class="mx">mx</span>
</span>
```

### CSS (copy these values)

```css
.brand-text {
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;          /* CRITICAL — see pitfalls */
  color: #FFFFFF;
}
.brand-text .period { color: #FFFFFF; }
.brand-text .mx { color: #84CC16; }
.brand-text .i-lime {
  position: relative;
  display: inline-block;
  line-height: 1;          /* CRITICAL */
  color: #FFFFFF;
}
.brand-text .i-lime .tittle {
  position: absolute;
  left: 50%;
  bottom: 0.64em;          /* natural i-dot height @ 36–56px */
  width: 0.17em;
  height: 0.17em;
  margin-left: -0.085em;
  border-radius: 50%;
  background: #84CC16;
  pointer-events: none;
}
```

### Size guide (1080² creatives)

| Context | Font size |
| --- | --- |
| Hook footer | ~36px |
| Promise inline (`…en bestie.mx`) | inherits ~56px |
| End URL | ~54px |

Scale only `font-size` on `.brand-text` — keep the tittle in **em** so it tracks.

## Pitfalls (hard fail)

| Mistake | Result | Fix |
| --- | --- | --- |
| Regular `i` + green circle | White native tittle + lime “double dot” | Use `ı` / `&#305;` |
| Missing `line-height: 1` on lockup / `.i-lime` | Em box taller than glyph → tittle floats too high | Set `line-height: 1` |
| `bottom` ≫ `0.64em` (e.g. `0.76em`) | Green floats above natural gap | Keep `0.64em` |
| `bottom` ≪ `0.64em` | Green sits on stem; white stem corners look like a second dot | Keep `0.64em` |
| Lime period | Wrong brand split | Period stays **white** |
| White `mx` | Weak URL | `mx` stays **lime** |
| Capital `B` | Wrong lockup | Always lowercase |

## Pixel QA (before shipping)

Crop the `i` only and confirm:

1. Character is U+0131 (`ı`), not U+0069 (`i`).
2. **No white pixels above** the green tittle.
3. **No white pixels inside** the green tittle band.
4. Small empty gap between green and stem (~natural `i` gap).

If (2)–(3) fail, re-check `line-height: 1` first, then `bottom` / size.

## SVG wordmark (product UI)

On-site SVG already draws a lime circle on a white i-stem and lime `mx` (`#84CC16`). Do **not** rebuild that with HTML unless the surface is a raster creative that needs large flat type. When matching SVG colors in HTML, use the same tokens above.

## Quick checklist

- [ ] Forest bg `#143D30` (or product context)
- [ ] `bestie` white, `.` white, `mx` lime
- [ ] Lime i-dot via `ı` + `.tittle`
- [ ] `line-height: 1` on `.brand-text` and `.i-lime`
- [ ] Tittle `bottom: 0.64em` / `0.17em`
- [ ] Lowercase lockup
- [ ] Pixel QA on the `i`
