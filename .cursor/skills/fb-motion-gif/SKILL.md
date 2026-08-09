---
name: fb-motion-gif
description: >-
  Best practices for GIF-like motion creatives on Facebook/Instagram (Page posts
  and Meta ads): format choice (MP4 vs GIF), size/duration specs, sequencing,
  hooks, sound-off design, text+image+decoration graphic loops, storytelling
  beats, transition timing, end-card takeaways, and Bestie brand motion
  patterns. Use when creating, reviewing, auditing, or optimizing Facebook GIFs,
  short loops, motion banners, kinetic text posts, animated brand cards, or
  Feed/Reels video creatives for Bestie.
---

# Facebook motion creatives (GIF-like) — Bestie

Guidance for **short looping motion** used on the Bestie MX Page and in Meta ads (publisher or seeker). Prefer **video that feels like a GIF** over a literal `.gif` file.

**Primary Bestie use case:** graphic motion built from **text + brand art + a few decorations** (GDL silhouettes, badge, CTA pill, high-five mark) — not UGC camera video. Design the **still / end frame first**, then animate.

**Canonical publisher example:** `public/brand/facebook/post-gdl-publishers-hi5.mp4` (paired static: `post-gdl-publishers-1080.png`).

## Default decision

| Goal | Ship |
| --- | --- |
| Page post / boost / Feed ad | **MP4** (H.264), square or 4:5 — Meta treats GIF uploads as video anyway |
| True `.gif` only | When the user explicitly needs GIF (email, Slack, non-Meta) |
| Reels / Stories | Separate **9:16** MP4 — do not stretch a square loop |

Meta’s own ad help: use high-quality motion, **subtle** movement; avoid flashing or heavily pixelated GIFs; GIFs may not play on all mobile devices — **video is more reliable**.

## Specs that matter (practical)

Hard Meta caps (video/GIF as video ad) are huge (~4 GB). Optimize for **mobile Feed**, not the cap.

| Item | Bestie default | Notes |
| --- | --- | --- |
| Aspect (Feed) | **1:1** `1080×1080` | Safe cross-placement; matches existing Bestie FB posts |
| Aspect (Feed mobile max) | **4:5** `1080×1350` | More vertical real estate if Feed-only |
| Aspect (Reels/Stories) | **9:16** `1080×1920` | Native; keep UI safe zones clear |
| Length (loop / GIF-like) | **~5–6 s** (ok band **3–6 s**) | Full story in one loop; avoid 15s+ “fake GIF” |
| Frame rate | **12–15 fps** graphic / **24** if UGC | 15 fps is a good Feed default for text cards |
| Codec | **H.264** MP4, yuv420p, `+faststart` | Sharp on mobile; smaller than GIF |
| GIF export (if needed) | ≤ **720²**, palette-optimized, **&lt; ~5 MB** | Prefer MP4 companion at 1080 |
| Loop | End-hold then restart | Hold final takeaway **≥1.0 s** before loop |

Keep critical content in the **center ~80%** of the frame (edges crop when Meta adapts placements; Reels/Stories UI covers top/bottom).

---

## Learned anti-patterns (do not repeat)

These failed in Bestie’s publisher motion iterations — treat as hard rules:

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| Blank / near-empty open | No scroll-stop in first ~500 ms | Badge or hook already moving/visible by frame 1 |
| Long support line **then** full static poster mid-loop | Same text twice; cognitive overload | One claim per beat; never restack the whole poster as a middle “slide” |
| Crossfades **&gt; ~0.6 s** | Feels sluggish on Feed | **~0.35 s** ease-in-out between beats |
| End card = only “Tu roomie, tu bestie.” | Peak–end memory stores identity, not the ask | End = **action takeaway** + mark + `bestie.mx` |
| Seeker tagline on publisher end | Wrong segment leave-behind | Publisher: “Publica … gratis”; seeker: find/roomie ask |
| Décor / broken assets stealing focus | Eye leaves the claim | Inline SVG décor; opacity ~40–60%; only on Promise beat |
| UTF-8 mojibake in Spanish (`PublÃcalo`) | Looks unprofessional | Prefer HTML entities (`&#191;`, `&#237;`, `&#183;`) in render HTML if the toolchain mangles UTF-8 |

---

## Use case: text + image + few decorations

Treat as **message-first motion graphics**, not a mini film.

### What to create (element budget)

| Role | Count | Bestie examples | Motion job |
| --- | --- | --- | --- |
| **Hook text** | 1 | `¿Tienes un cuarto libre?` / `¿Buscas roomie…?` | Appear in first **0.5–1 s** (fade+rise). Largest type. |
| **Promise text** | 0–1 | `Publícalo gratis en Bestie` (≤ ~8 words) | Own beat; lime on **1–2** keywords |
| **Badge / proof chip** | 0–1 | `NUEVO EN GUADALAJARA` | With hook only |
| **CTA pill** | 0–1 | `Publica gratis` | Own beat; **longest hold before end** |
| **Hero decoration** | 0–1 (max 2) | Cathedral / Arcos line-art | Only under Promise; never on Hook or End |
| **Brand close** | 1 | High-five mark + takeaway + `bestie.mx` | Final beat; designed still |
| **Micro accents** | 0–3 | Lime sparks on high-five | End only |

**Hard cap:** ≤ **6** attention objects per frame. Paused mid-loop must still read as a clean card.

### Still / end frame first (required)

1. Lock the **end takeaway frame** (mark + leave-behind + URL) and optionally the static poster for organic posts.
2. Animate **toward** those stills — do not invent motion and hope a good frame appears.
3. Loop must **start readable** and **end memorable** if autoplay fails or the thumb leaves early.

### Visual hierarchy

1. Motion / contrast (~first 500 ms)  
2. Hook text (segment)  
3. One promise cue (`gratis` / GDL / Bestie)  
4. CTA  
5. Brand seal + leave-behind  
6. Décor last (and only on Promise)

Early brand cue = **forest + lime** (and optional badge), not a slow logo bumper. Logo/mark resolves on the **end** (and may appear lightly on the static poster used outside the loop).

### Text rules (per slide)

| Rule | Guidance |
| --- | --- |
| One claim per beat | Do not combine hook + promise + CTA on one motion slide |
| Hook | ~**5–8 words** |
| Promise | ≤ **~8 words** (prefer shorter than a caption sentence) |
| CTA slide | Pill ≤ **3 words** + optional tiny qualifier line |
| End takeaway | ≤ **~6 words** action line + `bestie.mx` (+ optional small proof line) |
| Keyword highlight | Lime on **1–2 words** max per line |
| On-screen at once | Prefer **1** line; max **2** (+ small badge on Hook only) |
| Caption field | Holds empathy / context — **not** duplicated on-art |

### Decorations

| Do | Don’t |
| --- | --- |
| Thin lime line-art; ~40–60% opacity | Photo collages; competing with headline |
| Show with/after Promise text is readable | Before hook is readable |
| One motion language (fade) | Bounce each landmark differently |
| Inline SVG when rendering HTML frames | Broken `<img>` boxes mid-video |

### Motion vocabulary

| Element | Preferred motion |
| --- | --- |
| Hook | Fade + rise 8–16 px or scale 0.96→1 |
| Promise / badge | Fade + slight rise |
| CTA pill | Scale 0.9→1 ease-out (one punch) |
| Silhouettes | Opacity only |
| High-five mark | Scale 0.85→1.06→1.0; 2–3 sparks |
| Scene change | Crossfade **~0.35 s** |

---

## Four concepts to get right

### 1) Transition timing

- Between beats: **~0.30–0.40 s** ease-in-out (Feed graphic default **0.35 s**).
- Avoid dissolves **&gt; 0.6 s** (sluggish) and instant hard cuts between dense text cards (jarring).
- Cadence: new readable beat about every **~1.2–1.5 s** of *hold* (plus XF) → overall ~**0.3–0.5** scene changes/sec for graphic Feed loops.
- Hook motion can be fast; **CTA and End holds are longer** than hook entrance.

### 2) Amount of text per slide

- **Slide = one idea.** If you need more words, add a beat — don’t enlarge the paragraph.
- Never use the full multi-line static poster as a mid-loop slide (restacks hook+promise+CTA+footer).
- Static PNG is for the **Page photo / thumbnail**; motion is a **stripped beat sequence**.

### 3) Final slide (end card)

- Hold **≥ 1.0–1.5 s** (peak–end / recency: last seconds disproportionately shape memory).
- Contents: **high-five mark** + **one leave-behind line** + **`bestie.mx`** + optional small proof (`Hecha en GDL · Siempre gratis`).
- No competing animations while the takeaway is on screen (sparks settle quickly).
- Keep mark + text in center safe zone.

### 4) Most important leave-behind

Ask: *What should someone remember if they only recall the last frame?*

| Segment | Leave-behind (end line) | Not the leave-behind |
| --- | --- | --- |
| **Publisher** | `Publica tu cuarto gratis` + `bestie.mx` | Only “Tu roomie, tu bestie.” |
| **Seeker** | Find/roomie ask or “sin costo” + `bestie.mx` | Publisher “Publica…” CTA |

Brand tagline may appear **small** or only on static posters — it must **not** replace the action/offer on the end card.

**Mute story test (required):** at phone size, answer in order: *for whom → what’s the offer → what do I do / whose brand?* If any answer needs the caption, fix the beats.

---

## Canonical publisher timeline (~6.0 s)

Reference export: `post-gdl-publishers-hi5.mp4` (v5 / ~95-target).

```
0.00–1.15  Hook     white+lime badge + ¿Tienes un cuarto libre?
1.15–1.45  XF 0.30s
1.45–2.45  Promise  Publícalo gratis en Bestie + cathedral under text
2.45–2.75  XF 0.30s
2.75–3.95  CTA      Publica gratis + qualifier + whisper bestie.mx
3.95–4.25  XF 0.30s
4.25–6.00  End      high-five + bestie.mx (dominant) + Tu cuarto, gratis (~1.75s hold)
```

Seeker loops: same spine; swap hook/promise/CTA/end lines for demand; keep timing.

### Caption pairing

| Surface | Job |
| --- | --- |
| Motion | Hook → promise → CTA → leave-behind |
| Caption | Short empathy + **one** URL |
| Ad CTA | Match segment; separate supply vs demand campaigns |

Publisher URL: `https://www.bestie.mx/publicar`  
Seeker URL: `https://www.bestie.mx` or city landing.

---

## Do / Don’t

**Do:** still/end first; ease-out landings; `#143D30` / `#84CC16` / white; MP4 primary; end on high-five + action takeaway.

**Don’t:** flash; pixel mush GIF; audio-only punchlines; mix segments; décor-before-hook; poster dump mid-loop; seeker tagline as publisher leave-behind; Reels unsafe zones; letterbox square→9:16.

## Asset locations

| Asset | Path |
| --- | --- |
| Static publisher GDL | `public/brand/facebook/post-gdl-publishers-1080.png` |
| Motion publisher | `public/brand/facebook/post-gdl-publishers-hi5.mp4` (+ `.gif`) |
| Static seeker launch | `public/brand/facebook/post-gdl-launch-1080.png` |
| Logo mark | `public/brand/logo-mark.svg` |
| GDL décor sources | `public/brand/gdl/*.svg` |

Save as `post-{city}-{segment}-{note}.{mp4|gif}` under `public/brand/facebook/`, commit on **`develop`**, lead replies with **MP4**.

## Production checklist

```
Graphic motion audit:
- [ ] No blank open; motion/contrast in first ~0.5s
- [ ] Segment XOR clear in first 1s
- [ ] One claim per slide; hook ≤8 words; promise ≤~8 words
- [ ] No full static poster as a mid-loop slide
- [ ] XF between beats ~0.35s (not >0.6s)
- [ ] CTA hold longer than hook entrance
- [ ] End hold ≥1.0s; high-five + action takeaway + bestie.mx
- [ ] Leave-behind matches segment (publisher ≠ seeker tagline-only)
- [ ] Décor only on Promise; ≤6 objects/frame
- [ ] Mute phone story test passes
- [ ] Spanish glyphs correct (no mojibake)
- [ ] MP4 H.264 primary; Feed 1:1 or 4:5; loop 3–6s
- [ ] Caption short + one URL; campaigns not mixed by segment
```

## Sources (verify if Meta UI changes)

- [Use a GIF in your video ad (Meta Business Help)](https://www.facebook.com/business/help/1006874066021923) — GIF as video; subtle motion; video more reliable on mobile.
- Feed norms: hook early; design for mute; 1:1 / 4:5 Feed; 9:16 Reels; H.264; minimal on-image text; center safe zones.
- Pacing: graphic Feed ~0.3–0.5 scene changes/sec; CTA/end holds longer than hook motion.
- Peak–end / recency: last ~1–1.5s+ of a short loop disproportionately shape the stored impression — put brand + primary ask there.
- Motion graphics: one message per beat; still frame first; restrained easing.

## Related skills

- Page outreach comments: `fb-outreach-bestie-page`
- Personal outreach comments: `fb-outreach-personal`
