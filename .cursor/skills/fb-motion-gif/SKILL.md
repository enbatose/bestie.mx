---
name: fb-motion-gif
description: >-
  Playbook for Bestie short promotional motion on Facebook/Instagram (Page posts
  and Meta ads): MP4-as-GIF specs, 3-beat Hook→Promise→End spine, publisher vs
  seeker copy, city swap (GDL landmark décor), brand lockups, seek-driven capture
  pipeline, 95/100 quality bar, and learned production pitfalls. Use when creating,
  revising, or exporting Facebook motion creatives, short loops, kinetic brand
  cards, or Feed ads for any city or audience role.
---

# Facebook motion creatives (GIF-like) — Bestie

Short **looping graphic motion** for the Bestie MX Page and Meta ads. Prefer **MP4 that feels like a GIF** (not UGC).

**Design order:** lock the **End frame** first (brand + place + takeaway), then Hook and Promise.

**Companion skills (required when those elements appear):**

| Need | Skill |
| --- | --- |
| `bestie.mx` flat text + lime i-dot | [`bestie-url-lockup`](../bestie-url-lockup/SKILL.md) |
| High-five mark animation (classic / colorful) | [`bestie-mark-highfive`](../bestie-mark-highfive/SKILL.md) |
| GDL personas, POIs, seeker vs publisher voice | [`docs/gtm/gdl-marketplace-personas.md`](../../../docs/gtm/gdl-marketplace-personas.md) |

**Reference ship (GDL × publishers):** `public/brand/facebook/post-gdl-publishers-hi5.mp4`  
**Quality bar:** self-score **≥ 95 / 100** before shipping (rubric below).

---

## 1. Campaign parameters (ask before building)

Every creative is a product of **role × city**. Do not assume GDL or publishers.

| Param | Values | What it changes |
| --- | --- | --- |
| **Role** | `publisher` \| `seeker` | Hook question, Promise offer, caption URL, gratis placement |
| **City** | e.g. `gdl`, `cdmx`, … | Badge copy, End landmark décor, proof line locality |
| **Mark variant** | `colorful` (Promise default) \| `classic` | See `bestie-mark-highfive` |
| **Length** | default **~5.0 s** | Trimming holds evenly if user asks shorter/longer |

If the user only says “another one like this,” inherit role/city from the reference file name (`post-{city}-{role}-…`) and confirm.

### File naming

```
public/brand/facebook/post-{city}-{role}-{variant}.{mp4|gif|png}
```

Examples: `post-gdl-publishers-hi5.mp4`, `post-cdmx-seekers-hi5.mp4`.

### Caption / destination URLs

| Role | Primary URL |
| --- | --- |
| Publisher | `https://www.bestie.mx/publicar` |
| Seeker | `https://www.bestie.mx` or city landing |

Keep **separate ad creatives** per role (do not mix audiences in one loop).

---

## 2. Brand + layout constants (all cities / roles)

| Token | Hex | Use |
| --- | --- | --- |
| Forest | `#143D30` | Stage / gradient base |
| Lime | `#84CC16` | Accents, `mx`, i-dot, badge border, colorful mark |
| White | `#FFFFFF` | Primary type, left mark person, period in URL |
| Soft white | `rgba(255,255,255,.82)` | Proof line only |

**Stage:** radial forest gradient (lighter upper-left → deep forest).  
**Safe grid (1080²):** `padding: 120px 72px 140px`; flex column center; text max ~900–940px.  
**Type:** Inter / Segoe UI / system, weight **800**, `letter-spacing: -0.02em` on brand URL.

Badge recipe (End, sometimes Hook): white fill + **3px lime border** + `#143D30` text, ALL CAPS, wide tracking. Never lime-stroke-only on forest.

---

## 3. Story spine (canonical 3-beat)

**No separate CTA pill beat.** CTA lives in Promise copy + End URL + post caption.

```
Hook  (~1.0s hold)  Segment question + bottom brand footer
XF    0.30s
Promise (~1.5s)     Offer line + animated high-five mark (no footer)
XF    0.30s
End   (~1.9s)       Badge → city landmark → bestie.mx → slogan → proof
```

**Mute story test** (held frames only): *for whom → what’s the offer → whose brand / where?*

### Timing template (~5.0 s @ 15 fps)

```
HOOK_END=1017
PROMISE_START=1317   # HOOK_END + XF(300)
PROMISE_END=2783
END_START=3083       # PROMISE_END + XF(300)
TOTAL=5000
```

To cut **N** seconds evenly across 3 holds: subtract `N/3` from each hold; keep XF = 300ms. Recompute endpoints. Promise high-five (~1.55s) must still fit inside Promise hold + early XF.

### Specs

| Item | Default |
| --- | --- |
| Aspect | **1:1** 1080×1080 (optional 4:5 later) |
| Length | **~5.0 s** (band 4.8–5.5) |
| FPS | **15** |
| XF | **0.30 s** ease-in-out (never &gt;0.45 / &lt;0.25) |
| Codec | H.264 yuv420p `+faststart`; GIF optional companion |
| Capture | Playwright `deviceScaleFactor: 2` → ffmpeg lanczos → 1080 |

---

## 4. Role matrix (copy)

Spanish unless user asks otherwise. Use HTML entities in render HTML (`&#191;` `&#237;` …) to avoid mojibake.

### Publisher (supply) — shipped GDL reference

| Beat | On-screen |
| --- | --- |
| Hook | `¿Tienes un cuarto libre?` + footer mark + `bestie.mx` |
| Promise | `Publícalo gratis en bestie.mx` + **colorful** hi5 mark under text |
| End | Badge `NUEVO EN {CITY}` → landmark → `bestie.mx` → `Tu roomie, tu bestie.` → proof |

- **Gratis** only on Promise (don’t restack “gratis / sin costo” on End).  
- Caption URL → `/publicar`.

### Seeker (demand) — same spine, swap claims

| Beat | Pattern | Example |
| --- | --- | --- |
| Hook | Need / intent question | `¿Buscas roomie en {City}?` |
| Promise | Product benefit + brand | `Encuéntralo en bestie.mx` (+ hi5) |
| End | Same seal stack | Badge / landmark / URL / slogan / proof tuned to demand |

- Do **not** lead with “publícalo gratis.”  
- Caption URL → site or city landing.  
- Keep End hold longest; one claim per beat.

### Shared End lines

| Line | Notes |
| --- | --- |
| Slogan | `Tu roomie, tu bestie.` — lime on `tu bestie.` |
| Proof | Local + speed + channel, e.g. `Hecha en GDL - En Minutos - Sin Grupos` — soft white ~20px |

---

## 5. City matrix (décor + badge)

| City key | Badge example | Landmark (End) | Notes |
| --- | --- | --- | --- |
| `gdl` | `NUEVO EN GUADALAJARA` | `public/brand/gdl/minerva-silhouette-v4.png` | Prefer v4 PNG; brightness ~1.2 / saturate ~1.35 OK |
| future | `NUEVO EN {CITY}` | City-specific silhouette under `public/brand/{city}/` | Same End stack slot; don’t invent stroke-fattening |

**Rules for landmarks**

- End only (Promise uses **mark**, not landmark).  
- Original asset — **no** threshold recolor / multi drop-shadow thicken.  
- Capture 2× then lanczos downscale.  
- Sit in content stack under badge (gap ~18px), not a distant orphan.

Hook footer static mark: left white / right lime people + lime clap (settled) is fine; Promise **animated** mark defaults to **colorful** (see mark skill).

---

## 6. Per-beat layout (learned)

| Beat | Content | Brand chrome |
| --- | --- | --- |
| Hook | Question only in content | **Footer:** settled mark (~64px) + URL (~36px) |
| Promise | Offer (~56px) then hi5 (~280px) | **No** footer |
| End | Badge → landmark (~280) → URL (~54) → slogan (~38) → proof (~20) | **No** mark; URL text only |

Type scale: Promise ~85–95% of Hook optical size. Décor under Promise text (~20–28px gap).

Motion vocabulary: Hook fade+rise; Promise text fade+rise + hi5 seek anim; layers crossfade 0.30s; End elements ease in together.

---

## 7. Production pipeline (seek-driven)

CSS `animation` is **non-deterministic** under frame capture. Drive everything from `window.__seek(ms)`.

```
1. _tmp_gif/build-anim.cjs  → writes anim.html (1080 SVG/HTML/CSS + __seek)
2. Playwright chromium       → viewport 1080, deviceScaleFactor 2, seek each frame
3. ffmpeg                    → scale=1080:1080:flags=lanczos → MP4 (+ optional GIF 720)
4. Ship                      → public/brand/facebook/… ; commit develop; delete _tmp_gif
```

**Frame count:** `round(TOTAL_MS/1000 * 15)`; seek `i/(n-1)*TOTAL`.

**QA crops:** held frames only (not mid-XF). Pixel-check URL i-dot and hi5 colors when those change.

### Hard-won pitfalls (always apply)

| Pitfall | Fix |
| --- | --- |
| Lime i-dot floats / double-dot | Dotless `ı` + tittle; **`line-height:1`** on brand lockup — see `bestie-url-lockup` |
| Hi5 arms appear before bodies | Nest arms **inside** person groups for capture — see `bestie-mark-highfive` |
| Mojibake in Spanish | HTML entities in builder strings |
| PowerShell heredoc / escaping | Prefer `.cjs` Write files over inline `node -e` with HTML |
| GIF-only delivery | Always ship MP4 primary |
| Auditing XF midpoints | Score opacity/contrast on **held** frames |
| Shrinking type to fit long Spanish | Prefer soft hyphens in product UI chips; in motion, shorten copy or keep scale |

Legal: pure marketing creative / no new product data collection → no Terms/Privacy bump (still check if copy implies new features).

---

## 8. 95 / 100 quality bar

Score each row 0–10; average ×10. **Do not ship below 95.**

| # | Criterion | 95-pass |
| --- | --- | --- |
| 1 | Length | 4.8–5.5 s |
| 2 | Holds | End longest; XF 0.30s |
| 3 | Time use | &lt;~16% in XF; no blank open |
| 4 | Elements | ≤6/frame; mark on Promise; landmark on End |
| 5 | Colors | Forest / lime / white; badge white+lime border |
| 6 | Proportions | Shared grid; Promise type ~85–95% Hook |
| 7 | Messaging | One claim/beat; role XOR; city consistent |
| 8 | Story | Hook→Promise→End; mute test passes |
| 9 | Contrast | White/lime on forest |
| 10 | Readability | Arm’s-length phone on held frames |

---

## 9. Anti-patterns (hard fail)

| Don’t | Do |
| --- | --- |
| Blank / empty first frames | Hook visible early; footer on Hook |
| Full poster dump mid-loop | Three stripped beats only |
| XF &gt; 0.45s | 0.30s |
| End = slogan only | Badge + landmark + URL + slogan + proof |
| CTA pill as its own beat | Promise + caption carry CTA |
| Restack gratis/GDL/URL on every beat | Gratis→Promise; city→badge/proof; URL→End (+ footer Hook) |
| Lime-only badge stroke on forest | White fill + lime border |
| Décor orphaned at bottom | Flex stack under the claim |
| Classic/colorful mark mix-up without asking | Confirm variant; Promise default = colorful |
| Same creative for publishers and seekers | Split campaigns |

---

## 10. Agent workflow (new city or role)

```
1. Confirm role + city + mark variant + length
2. Swap copy matrix + badge + landmark asset
3. Keep spine/timing/grid/brand lockups
4. Build anim.html with __seek; capture 2×; encode MP4 (+GIF)
5. Spot-check held frames (URL i-dot, hi5 colors, landmark)
6. Score ≥95; name post-{city}-{role}-…; commit develop; lead with MP4
```

### Checklist

```
- [ ] Role × city confirmed; filename matches
- [ ] ~5.0s @ 15fps; XF 0.30s; End hold longest
- [ ] Hook question + footer; Promise offer + hi5; End seal stack
- [ ] bestie-url-lockup + bestie-mark-highfive rules applied
- [ ] Landmark = city asset, no stroke fattening
- [ ] Mute story test; Spanish entities OK
- [ ] MP4 primary; develop push
```

---

## 11. Assets

| Asset | Path |
| --- | --- |
| GDL publishers motion (ref) | `public/brand/facebook/post-gdl-publishers-hi5.mp4` |
| GDL publishers still | `public/brand/facebook/post-gdl-publishers-1080.png` |
| GDL seeker still | `public/brand/facebook/post-gdl-launch-1080.png` |
| Minerva (GDL End) | `public/brand/gdl/minerva-silhouette-v4.png` |
| Minerva legacy SVG | `public/brand/gdl/minerva-silhouette.svg` |
| Cathedral alt | `public/brand/gdl/cathedral-silhouette.svg` |

## Sources

- Meta: GIF-as-video; subtle motion; mobile prefers video over GIF.  
- Feed: mute-first; hook early; 1:1 / 4:5; H.264.  
- Peak–end: last ≥1.5s carries memory — brand URL + place belong there.

## Related

- `bestie-url-lockup` · `bestie-mark-highfive` · `fb-outreach-bestie-page` · `fb-outreach-personal`
