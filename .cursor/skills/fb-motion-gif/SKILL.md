---
name: fb-motion-gif
description: >-
  Best practices for GIF-like motion creatives on Facebook/Instagram (Page posts
  and Meta ads): format choice (MP4 vs GIF), size/duration specs, sequencing,
  hooks, sound-off design, and Bestie brand motion patterns. Use when creating,
  reviewing, or optimizing Facebook GIFs, short loops, motion banners, animated
  posts, or Feed/Reels video creatives for Bestie.
---

# Facebook motion creatives (GIF-like) — Bestie

Guidance for **short looping motion** used on the Bestie MX Page and in Meta ads (publisher or seeker). Prefer **video that feels like a GIF** over a literal `.gif` file.

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

## What to focus on (priority order)

1. **First 1–3 seconds (hook)** — motion or contrast that stops the thumb. Lead with the **segment question or offer**, not a slow logo intro.
2. **One job per loop** — publisher *or* seeker; never mix “busca roomie” and “publica cuarto” in one asset.
3. **Readable without sound** — Feed autoplay is usually muted. Burn key words into the frame (headline already is text-on-art).
4. **Brand close** — last beat: Bestie **high-five mark** + `bestie.mx` and/or “Tu roomie, tu bestie.” (see sequencing).
5. **Local GDL cue** — cathedral / Arcos (or Minerva) silhouettes when the post is Guadalajara launch.
6. **Caption pairing** — image/motion = hook + proof; caption = empathy + link. Don’t duplicate a paragraph on-screen.

## Sequencing (GIF-like storyboard)

Use this spine unless the user specifies another:

```
0.0–0.8s   Hook on-screen (segment question or pattern interrupt) + light motion
0.8–2.5s   Value frame (poster / benefit / GDL) — readable still if paused
2.5–3.5s   CTA beat ("Publica gratis" / "Busca roomie") OR brand proof
3.5–4.5s   Close on Bestie high-five mark + bestie.mx (+ optional tagline)
           Hold ~0.5–1s so the mark registers, then loop
```

### Do

- Motion with **purpose**: fade, slide, scale punch, silhouette reveal — one primary move at a time.
- High contrast: forest `#143D30`, lime `#84CC16`, white (Bestie tokens).
- End on the **logo mark** (two figures high-five), not a random last frame.
- Keep text large; assume phone at arm’s length.

### Don’t

- Flash / strobe / seizure-risk flicker (also hurts ad quality / policy).
- Tiny text, dense paragraphs, or &gt; ~20% of the frame as unreadably small copy.
- Slow 2s logo bumper before the hook.
- Rely on audio for the message.
- Pixelated dithered GIF when MP4 is an option.
- Put critical text in Reels/Stories **top ~14% / bottom ~20%+** UI safe zones.

## Caption + motion (Page post)

| Surface | Job |
| --- | --- |
| Motion | Stop scroll + segment + brand close |
| Caption | Short mobile-first: hook → value → single URL |
| Ad CTA button | Match segment (`/publicar` vs search); separate campaigns for supply vs demand |

Publisher URL: `https://www.bestie.mx/publicar`  
Seeker URL: `https://www.bestie.mx` or city search landing.

## Asset locations (Bestie repo)

| Asset | Path |
| --- | --- |
| Static publisher GDL | `public/brand/facebook/post-gdl-publishers-1080.png` |
| Motion publisher (GIF + MP4) | `public/brand/facebook/post-gdl-publishers-hi5.gif` / `.mp4` |
| Static seeker launch | `public/brand/facebook/post-gdl-launch-1080.png` |
| Logo mark (source) | `public/brand/logo-mark.svg` |

When creating new motion: save under `public/brand/facebook/` with a clear name (`post-{city}-{segment}-{note}.{mp4|gif}`), commit on **`develop`**, deliver **MP4 first** in the reply.

## Production checklist

Copy and track:

```
Motion creative:
- [ ] Segment clear in first 1s (publisher XOR seeker)
- [ ] MP4 H.264 primary; GIF only if requested
- [ ] Feed size 1:1 or 4:5 at ≥1080 on short side
- [ ] Loop 3–6s; readable if paused mid-loop
- [ ] Sound-off OK (text on frame)
- [ ] Subtle motion; no flash
- [ ] Closes on Bestie high-five mark
- [ ] Caption short + one URL; ad campaign not mixed with other segment
```

## Sources (verify if Meta UI changes)

- [Use a GIF in your video ad (Meta Business Help)](https://www.facebook.com/business/help/1006874066021923) — GIF as video; prefer subtle motion; video more reliable on mobile.
- Meta Feed video norms (industry 2025–2026 consensus): 1:1 / 4:5 Feed; 9:16 Reels; hook in first seconds; design for mute; H.264 MP4.

## Related skills

- Page outreach comments: `fb-outreach-bestie-page`
- Personal outreach comments: `fb-outreach-personal`
