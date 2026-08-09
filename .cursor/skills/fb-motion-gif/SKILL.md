---
name: fb-motion-gif
description: >-
  Best practices for GIF-like motion creatives on Facebook/Instagram (Page posts
  and Meta ads): format choice (MP4 vs GIF), size/duration specs, sequencing,
  hooks, sound-off design, text+image+decoration graphic loops, storytelling
  beats, and Bestie brand motion patterns. Use when creating, reviewing, or
  optimizing Facebook GIFs, short loops, motion banners, kinetic text posts,
  animated brand cards, or Feed/Reels video creatives for Bestie.
---

# Facebook motion creatives (GIF-like) — Bestie

Guidance for **short looping motion** used on the Bestie MX Page and in Meta ads (publisher or seeker). Prefer **video that feels like a GIF** over a literal `.gif` file.

**Primary Bestie use case:** graphic motion built from **text + brand art + a few decorations** (GDL silhouettes, badge, CTA pill, high-five mark) — not UGC camera video. Design the **still frame first**, then animate.

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
| Length (loop / GIF-like) | **3–6 s** | Full message in one loop; avoid 15s+ “fake GIF” |
| Length (story DR video) | **6–15 s** | Hook → proof → CTA; not required for brand loops |
| Frame rate | **12–24 fps** | 12 fps fine for graphic loops; 24 if camera/UGC |
| Codec | **H.264** MP4, yuv420p, `+faststart` | Sharp on mobile; smaller than GIF |
| GIF export (if needed) | ≤ **720²**, palette-optimized, **&lt; ~5 MB** | Prefer MP4 companion at 1080 |
| Loop | Seamless or intentional end-hold | End on brand beat, then loop or freeze 0.5–1 s |

Keep critical content in the **center ~80%** of the frame (edges crop when Meta adapts placements; Reels/Stories UI covers top/bottom).

---

## Use case: text + image + few decorations

This is Bestie’s default motion type (GDL launch cards). Treat it as **message-first motion graphics**, not a mini film.

### What to create (element budget)

Build from a capped inventory. More elements ≠ better story — they compete for the thumb.

| Role | Count | Bestie examples | Motion job |
| --- | --- | --- | --- |
| **Hook text** | 1 | `¿Tienes un cuarto libre?` / `¿Buscas roomie…?` | Appear in first **0.5–1 s** (snap/fade+rise). Largest type. |
| **Support text** | 0–1 | One line; lime on **1–2 keywords** only (`gratis`, city) | Follow hook by ~0.3–0.6 s. Never a paragraph. |
| **Badge / proof chip** | 0–1 | `NUEVO EN GUADALAJARA` | Soft fade or pill draw; optional early. |
| **Wordmark / URL** | 0–1 early *or* end | `bestie.mx` | Prefer **end card** over long intro bumper. |
| **CTA pill** | 0–1 | `Publica gratis` | Mid/late beat; scale-in once. |
| **Hero decoration** | 1–2 max | Cathedral + Arcos line silhouettes | Ambient: slow fade/parallax; never steal from headline. |
| **Brand close** | 1 | High-five **logo mark** + tagline | Final beat; settle on a designed **still**. |
| **Micro accents** | 0–3 | Lime sparks at high-five, soft gradient orb | Only on the close; no continuous sparkle spam. |

**Hard cap:** ≤ **6 simultaneous “attention objects”** on any single frame (headline counts as 1). If paused mid-loop, the frame must still read as a clean poster.

### Still frame first (required)

1. Design / approve the **final readable poster** (or end card) as a static composition.
2. Animate **toward** that still — do not invent motion and hope a good frame appears.
3. Every loop should **start or end** on a frame that works as a thumbnail if autoplay fails.

### Visual hierarchy (what the eye should hit)

Order of attention in graphic Feed motion:

1. Motion or contrast change (orienting response, first ~500 ms)
2. Hook text (segment question / claim)
3. One proof cue (GDL / gratis / nuevo)
4. CTA or brand close
5. Decorations last (local flavor, not the story)

Put the primary hook in the **upper-middle** of the square (scroll eye-line). Keep logos/CTAs from fighting the headline on the same beat.

### Text rules (on-art)

Meta no longer hard-rejects “too much text,” but **minimal overlay still performs better**. Put detail in the **caption field**, not on the art.

| Rule | Guidance |
| --- | --- |
| Hook length | ~**5–8 words** (one breath) |
| Support line | ≤ **12–14 words**; prefer shorter |
| Keyword highlight | Lime on **1–2 words** max per line |
| Lines on screen at once | Prefer **1**, max **2** (+ small badge) |
| Size | Arm’s-length mobile: headline dominant; no fine print as the message |
| Sound-off | The art **is** the caption — assume mute |

Do **not** animate letter-by-letter for the full hook if it delays readability past ~1 s. Prefer whole-line fade/slide.

### Decoration (GDL / brand)

Decorations **support place and brand**; they are not plot.

| Do | Don’t |
| --- | --- |
| Thin lime line-art landmarks, low opacity (~40–60%) | Dense city collages, photo backgrounds fighting text |
| Reveal silhouettes **after** or **with** the value frame | Animate decorations before the hook is readable |
| One motion language (fade / soft rise) for all décor | Each landmark bouncing differently |
| Hold décor steady under text | Parallax so strong text feels unstable |

### Motion vocabulary (allowed moves)

Use **one primary move per beat**. Ease out / ease-in-out; avoid linear snaps that feel unfinished.

| Element | Preferred motion |
| --- | --- |
| Hook text | Fade + slight rise (8–16 px) or soft scale 0.96→1 |
| Support / badge | Fade only or fade + slight rise |
| CTA pill | Scale 0.9→1 with ease-out (one punch) |
| Silhouettes | Opacity 0→target; optional tiny horizontal drift |
| High-five mark | Scale punch 0.75→1.05→1.0; optional 2–3 spark dots |
| Scene change | Crossfade 0.3–0.5 s — not a wipe circus |

**Scene change cadence:** new readable beat about every **1.0–1.5 s** inside a 3–6 s loop (graphic loops can hold longer than UGC cuts). Avoid holding a near-blank frame.

### Storytelling spine (text + décor loops)

Map story to **beats**, not to camera shots. Prefer **one claim per slide**.

```
Beat A — Hook (~1.2–1.4s hold after appear)
  Question or claim + optional badge. Segment clear.
  Early brand via color system (forest/lime), not a slow logo bumper.

Beat B — Promise (~1.0–1.3s)
  ONE short line (≤ ~8 words). Décor may fade under (never before text is readable).
  Do NOT dump the full static poster mid-loop (too much text at once).

Beat C — CTA peak (~1.2–1.4s hold)
  Action pill + tiny qualifier. Longest readable pause before the end.
  Hook moves fast; CTA holds longer.

Beat D — End seal / takeaway (~1.0–1.5s hold)  [peak–end memory]
  High-five mark + the ONE leave-behind message + bestie.mx.
  Publisher leave-behind: “Publica … gratis” + bestie.mx (not only the seeker tagline).
  Seeker leave-behind: “Encuentra …” / roomie hook + bestie.mx.
  Tagline “Tu roomie, tu bestie.” is optional secondary — never replace the action takeaway.
```

**Transitions:** crossfade / dissolve **~0.3–0.4 s** between beats (Feed). Avoid >0.6 s soft dissolves that feel sluggish. Target ~**0.3–0.5 cuts/sec** for graphic Feed loops (new beat ~every 2–3 s).

**Timing research cheat sheet**

| Concept | Practice |
| --- | --- |
| Transition length | ~0.3–0.4 s ease for graphic loops |
| Text per slide | 1 headline; ≤1 support line; ≤ ~8–12 words total on that beat |
| CTA hold | Longer than hook motion; give time to read the ask |
| Final slide | 1.0–1.5 s+; logo/mark + clear takeaway + URL; no competing animations |
| Leave-behind | Peak–end: last frame = brand + primary action/offer the brain stores |

**Story test:** mute the video, watch once at phone size. Can you answer in order: *who is this for → what’s the offer → what should I do / whose brand?* If any answer needs the caption, strengthen that beat on-art.

### Caption pairing (same as static, stricter with motion)

| Surface | Job |
| --- | --- |
| Motion | Stop scroll + segment + one promise + brand seal |
| Caption | Empathy / context + **one** URL (mobile-short) |
| Ad CTA button | Match segment; separate supply vs demand campaigns |

Publisher URL: `https://www.bestie.mx/publicar`  
Seeker URL: `https://www.bestie.mx` or city landing.

Do not paste the full on-art paragraph into the caption.

---

## What to focus on (priority order)

1. **First 1–3 seconds (hook)** — motion + segment question/claim; no slow logo intro.
2. **One job per loop** — publisher *or* seeker.
3. **Readable without sound** — text on frame is mandatory for graphic loops.
4. **Element budget** — few decorations; hierarchy over clutter.
5. **Brand close** — Bestie high-five mark as designed still.
6. **Local GDL cue** — silhouettes as support, not the hook.
7. **Caption pairing** — motion ≠ caption dump.

## Sequencing (quick reference)

```
0.0–0.8s   Hook text + light motion (+ optional badge)
0.8–2.5s   Value / poster + GDL décor settle
2.5–3.5s   CTA punch (if not already on poster)
3.5–4.5s   High-five mark + bestie.mx + tagline; hold; loop
```

### Do

- Still frame first; ease-out landings; high contrast (`#143D30` / `#84CC16` / white).
- End on the **logo mark**, not a random last frame.
- Ship **MP4** primary for Meta.

### Don’t

- Flash / strobe; pixel mush GIF; audio-dependent punchlines.
- More than one CTA idea; mixing segments; décor-before-hook.
- Critical text in Reels/Stories top/bottom UI bands.
- Letterboxing a square into 9:16 for Reels.

## Asset locations (Bestie repo)

| Asset | Path |
| --- | --- |
| Static publisher GDL | `public/brand/facebook/post-gdl-publishers-1080.png` |
| Motion publisher (GIF + MP4) | `public/brand/facebook/post-gdl-publishers-hi5.gif` / `.mp4` |
| Static seeker launch | `public/brand/facebook/post-gdl-launch-1080.png` |
| Logo mark (source) | `public/brand/logo-mark.svg` |

Save new motion under `public/brand/facebook/` as `post-{city}-{segment}-{note}.{mp4|gif}`, commit on **`develop`**, lead the reply with **MP4**.

## Production checklist

```
Graphic motion (text + art + décor):
- [ ] Still/poster designed before animating
- [ ] Segment clear in first 1s (publisher XOR seeker)
- [ ] Hook ≤ ~8 words; ≤1 support line; caption holds the rest
- [ ] ≤6 attention objects per frame; décor doesn’t outrank text
- [ ] Motion starts in first ~0.5s (not a static open)
- [ ] Beats: Hook → Promise/Place → CTA? → Brand seal
- [ ] Mute story test passes on phone-sized preview
- [ ] MP4 H.264 primary; GIF only if requested
- [ ] Feed 1:1 or 4:5 ≥1080; loop 3–6s; center-safe content
- [ ] Closes on Bestie high-five mark + hold
- [ ] Caption short + one URL; campaigns not mixed by segment
```

## Sources (verify if Meta UI changes)

- [Use a GIF in your video ad (Meta Business Help)](https://www.facebook.com/business/help/1006874066021923) — GIF as video; subtle motion; video more reliable on mobile.
- Industry Feed norms (2025–2026): hook in first seconds; design for mute; 1:1 / 4:5 Feed; 9:16 Reels; H.264 MP4; minimal on-image text outperforms dense overlays; center safe zones.
- Motion-graphics practice: message hierarchy (hook → core → proof → CTA); still frame first; restrained easing; logo end card as brand seal.

## Related skills

- Page outreach comments: `fb-outreach-bestie-page`
- Personal outreach comments: `fb-outreach-personal`
