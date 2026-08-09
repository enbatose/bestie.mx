---
name: fb-motion-gif
description: >-
  Best practices for GIF-like motion creatives on Facebook/Instagram (Page posts
  and Meta ads): format choice (MP4 vs GIF), size/duration specs, sequencing,
  hooks, sound-off design, text+image+decoration graphic loops, storytelling
  beats, transition timing, end-card takeaways, 95/100 quality bar, and Bestie
  brand motion patterns. Use when creating, reviewing, auditing, scoring, or
  optimizing Facebook GIFs, short loops, motion banners, kinetic text posts,
  animated brand cards, or Feed/Reels video creatives for Bestie.
---

# Facebook motion creatives (GIF-like) — Bestie

Guidance for **short looping motion** on the Bestie MX Page and Meta ads. Prefer **MP4 that feels like a GIF**.

**Primary use case:** graphic motion = **text + brand art + few decorations** (not UGC). Design **end frame first**, then animate.

**Quality bar:** ship only when a self-score hits **≥ 95 / 100** (rubric below). Reference: `public/brand/facebook/post-gdl-publishers-hi5.mp4` (v5) + static `post-gdl-publishers-1080.png`.

## Default decision

| Goal | Ship |
| --- | --- |
| Page post / boost / Feed ad | **MP4** H.264, 1:1 or 4:5 |
| True `.gif` | Only if user asks; always pair with MP4 |
| Reels / Stories | Native **9:16** — never letterbox a square |

Meta: subtle motion; avoid flash/pixel mush; video more reliable than GIF on mobile.

## Specs (practical)

| Item | **95-bar default** | Notes |
| --- | --- | --- |
| Aspect (Feed) | **1:1** `1080×1080` | Optional extra: **4:5** `1080×1350` for max mobile Feed |
| Length | **~6.0 s** (band 5.5–6.2) | Full spine in one loop |
| Frame rate | **15 fps** | Graphic text cards |
| XF between beats | **0.30 s** ease-in-out | Never &gt; 0.45 s; never &lt; 0.25 s |
| End hold | **≥ 1.5 s** (target **~1.75 s**) | Longest or tied-longest beat |
| CTA hold | **≥ 1.1 s** | Longer than hook *entrance* |
| Hook hold | **~1.0–1.2 s** after appear | Appear finishes by ~0.4 s |
| Codec | H.264, yuv420p, `+faststart` | Lead delivery with MP4 |
| Safe content | Center **~80%** | Shared padding ~120px top / 140px bottom / 72px sides |

---

## 95 / 100 quality bar (required)

Before shipping, score each row 0–10 and average ×10. **Do not ship below 95.** If &lt;95, fix the lowest rows first (usually end hold, type scale, badge contrast, CTA≠end).

| # | Criterion (×10) | 95-pass standard |
| --- | --- | --- |
| 1 | Overall length | 5.5–6.2 s loop; not 15s+ |
| 2 | Slide lengths | End ≥1.5s; CTA ≥1.1s; XF 0.30s; end longest/tied |
| 3 | Time use | &lt;~16% runtime in XF; no blank open |
| 4 | Elements | ≤6 objects/frame; décor only on Promise; mark on End |
| 5 | Colors | Forest `#143D30` / lime `#84CC16` / white; **badge = white fill + lime border + dark text** |
| 6 | Sizes / proportions | Shared grid; Promise type ≈ **85–95%** of Hook optical size; décor **under** Promise text (gap ~20px) |
| 7 | Messaging | One claim/beat; segment XOR; free reinforced without identical CTA=End |
| 8 | Storytelling | Hook → Promise → CTA → End; mute story test passes |
| 9 | Text contrast | White/lime on forest; badge never lime-on-forest stroke-only |
| 10 | Readability | Arm’s-length phone; held frames fully opaque white/lime (don’t audit mid-XF fades as “low contrast”) |

**Pass rule:** all rows ≥9, or average ≥9.5 with no row &lt;8.

---

## Learned anti-patterns (hard fail)

| Anti-pattern | Do instead |
| --- | --- |
| Blank / low-opacity open | Badge ≥~0.75 opacity on frame 0; hook moving by ~0.5s |
| Full static poster mid-loop | Stripped beats only; poster = organic still / thumbnail |
| XF &gt; 0.45s (esp. ≥0.6s) | **0.30 s** default |
| End hold &lt; 1.0s | **≥ 1.5 s** (target 1.75s) |
| End = only “Tu roomie, tu bestie.” | End = **mark + `bestie.mx` dominant + short offer line** |
| CTA pill repeated as End | CTA = action pill; End = brand URL + short takeaway |
| CTA qualifier restates GDL / sin costo / URL | Qualifier = new benefit (`sin grupos · en minutos`); domain only on End |
| Lime stroke badge on forest | **White fill + lime 3px border + `#143D30` text** |
| Promise type ≪ Hook | Promise **~88–95%** of Hook size; attach décor below |
| Décor orphaned at bottom | Flex stack: text then décor (gap ~20px), opacity ~0.55–0.60 |
| Mojibake (`PublÃcalo`) | HTML entities in render HTML: `&#191;` `&#237;` `&#183;` |

---

## Element recipes (95-bar)

### Badge (Hook only)

```
Background: #FFFFFF
Border: 3px solid #84CC16
Text: #143D30, bold, ~24px, tracking wide, ALL CAPS
Copy e.g. NUEVO EN GUADALAJARA
```

### Type scale (1080²)

| Element | Size guide | Color |
| --- | --- | --- |
| Hook | **~68–72px** bold white | `#FFFFFF` + light shadow |
| Promise | **~54–58px** (~85–90% of Hook) | white; lime on `gratis` (+ optional `.mx`) |
| End URL | **~48–52px** lime **dominant** | Primary end eye-catch after mark |
| End takeaway | **~34–38px** | slogan `Tu roomie, tu bestie.` (lime on `tu bestie.`) |
| End proof | **~18–22px** soft white | `Hecha en GDL · Sin grupos de FB · en minutos` |
| Brand footer (Hook + Promise) | mark **~64px** + word **~36px** | Bottom-centered inside **140px** bottom pad |

### Persistent brand footer (Hook only)

Centered lockup in the bottom safe band (skill padding `140px` bottom / `72px` sides):

- High-five **mark** + `bestie` (white) + `.mx` (lime)
- **Promise:** no footer — center claim + **animated** landing high-five mark only
- **End:** no mark; `bestie.mx` word only after Minerva

### End seal stack (no separate CTA beat)

| On-screen | Job |
| --- | --- |
| Badge `NUEVO EN GUADALAJARA` | Place / news |
| Minerva v4 (landing PNG, brighter) | Local décor under badge |
| `bestie.mx` | Brand URL (no mark) |
| `Tu roomie, tu bestie.` | Brand slogan |
| `Hecha en GDL · Sin grupos de FB · Crea tu post en minutos` | Proof / benefit line |

Publisher leave-behind = **brand + local + slogan**, not a duplicate CTA pill.

**Gratis budget:** *gratis* lives on Promise only in this spine (`Publícalo gratis en Bestie.mx`).

### Décor

- **Promise:** Bestie mark (high-five) under offer line — not Minerva
- **End:** La Minerva landing desktop asset (`minerva-silhouette-v4.png`)
- **Do not** threshold-recolor or 1px multi drop-shadow thicken Minerva
- Capture at **deviceScaleFactor 2** then lanczos-downscale to 1080
- Directly in the content stack (not a distant orphan footer)

### Layout grid

All slides share the same content band:

- `padding: ~120px 72px 140px`
- Flex column, center align
- Max text width ~900–940px

---

## Story spine + timing

```
Beat A Hook     ~1.5s hold    Segment question + bottom brand footer
Beat B Promise  ~1.5s hold    Offer line + Bestie mark décor + footer
Beat C End      ~2.4s hold    Badge + mark seal + slogan + Minerva + proof
XF between beats: 0.30s each  (2 XFs only — no CTA beat)
```

### Canonical publisher timeline (~6.0 s) — copy this (v8)

```
0.00–1.35  Hook     ¿Tienes un cuarto libre? + footer mark/bestie.mx
1.35–1.65  XF 0.30s
1.65–3.45  Promise  Publícalo gratis en Bestie.mx + landing high-five mark anim (no footer)
3.45–3.75  XF 0.30s
3.75–6.00  End      NUEVO EN GUADALAJARA → Minerva (brighter) → bestie.mx (no mark)
                    → Tu roomie, tu bestie. → Hecha en GDL · Sin grupos de FB · Crea tu post en minutos
```

Promise high-five must match `HeroAnimatedLockup` / `index.css`: people in → arms raise (~0.55s delay) → clap grow (~1.2s). Drive via `__seek` (not CSS `animation`) so frame capture is deterministic.

Seeker: same 3-beat timing; swap copy for demand; keep end hold longest.

**Mute story test:** *for whom → offer → whose brand / where?* Must pass on held frames (ignore mid-XF).

### Caption pairing

| Surface | Job |
| --- | --- |
| Motion | Hook → Promise → End seal |
| Caption | Short empathy + one URL |
| Ad campaigns | Publisher ≠ seeker creatives |

Publisher URL: `https://www.bestie.mx/publicar`  
Seeker URL: `https://www.bestie.mx` or city landing.

---

## Motion vocabulary

| Element | Motion |
| --- | --- |
| Hook | Fade + rise 8–14px / scale 0.97→1 |
| Promise | Fade + slight rise; Bestie mark décor scale-in |
| Brand footer | Opacity with Hook/Promise layers |
| End badge | Fade + slight rise |
| End mark | Scale 0.88→1.05→1.0; 2–3 sparks then settle |
| Minerva | Opacity with End |
| Scene change | Crossfade **0.30 s** |

---

## Production checklist (≥95)

```
95-bar motion:
- [ ] Self-score ≥95 using rubric (no row <8)
- [ ] ~6.0s @ 15fps; XF 0.30s; End hold longest (≥2.0s in 3-beat spine)
- [ ] Hook opens with question + footer (no blank; badge not required on Hook)
- [ ] One claim per beat; no poster dump mid-loop; **no CTA pill beat**
- [ ] Hook + Promise: bottom mark + bestie.mx footer inside padding
- [ ] Promise: Bestie mark décor + Publícalo gratis en Bestie.mx
- [ ] End: badge + mark + bestie.mx + Tu roomie, tu bestie. + Minerva + proof line
- [ ] Badge = white fill + lime border + dark text (on End)
- [ ] Minerva = original landing v4 PNG (no stroke fattening)
- [ ] Shared layout grid / margins (120 / 72 / 140)
- [ ] Mute story test on HELD frames
- [ ] Spanish via HTML entities if needed (no mojibake)
- [ ] MP4 primary (+ GIF optional); center-safe; segment campaigns separate
```

## Iterate loop (agent)

1. Build to canonical timeline + recipes.  
2. Export MP4; grab held frames (not XF midpoints).  
3. Score rubric.  
4. If &lt;95: fix lowest criterion → re-export → rescore.  
5. Ship to `public/brand/facebook/`, commit **`develop`**, lead with MP4 path.

## Assets

| Asset | Path |
| --- | --- |
| Static publisher | `public/brand/facebook/post-gdl-publishers-1080.png` |
| Motion publisher (95-bar ref) | `public/brand/facebook/post-gdl-publishers-hi5.mp4` |
| Static seeker | `public/brand/facebook/post-gdl-launch-1080.png` |
| Mark | `public/brand/logo-mark.svg` |
| Décor (preferred GDL — landing desktop) | `public/brand/gdl/minerva-silhouette-v4.png` |
| Décor (legacy SVG) | `public/brand/gdl/minerva-silhouette.svg` |
| Décor (alt) | `public/brand/gdl/cathedral-silhouette.svg` / `cathedral-silhouette-v3.png` |

## Sources

- Meta Business Help: GIF-as-video; subtle motion; video more reliable on mobile.  
- Feed: mute-first; hook early; 1:1/4:5; H.264; minimal on-art text.  
- Peak–end: last **≥1.5s** carries disproportionate memory — brand URL + offer there.  
- Pacing: XF ~0.30s; CTA/end holds longer than hook entrance.

## Related skills

- `fb-outreach-bestie-page` · `fb-outreach-personal`
