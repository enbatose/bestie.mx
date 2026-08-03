# Bestie × PostHog analytics

Product analytics for usage behavior. Client SDK: `posthog-js` + `@posthog/react`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_POSTHOG_PROJECT_TOKEN` | Project token (`phc_…`) — public, browser-safe |
| `VITE_POSTHOG_HOST` | Ingestion host (US: `https://us.i.posthog.com`) |
| `POSTHOG_PERSONAL_API_KEY` | Personal API key (`phx_…`) on the **API** Railway service (Dev + Prod) — powers Admin → Métricas live usage (recordings / events). Needs **query** scope. Create at https://us.posthog.com/settings/user-api-keys |
| `POSTHOG_PROJECT_ID` | Optional override (default `517444`) |
| `POSTHOG_API_HOST` | Optional override (default `https://us.posthog.com`) |

Set these on the **production** Railway service (`bestie-prod`) only. Vite inlines `VITE_*` at build time — **never** set them on `bestie-dev`, local `.env`, or preview deploys.

The root [`Dockerfile`](../Dockerfile) must declare matching `ARG`/`ENV` for each `VITE_*` var (same pattern as `VITE_GOOGLE_MAPS_EMBED_KEY`). Railway only forwards service variables into the Docker build when they are declared as build args — without `VITE_POSTHOG_*` ARGs the Prod SPA ships an empty token, PostHog never inits, and admin Posts stay on **Sin replay**. Redeploy Prod after adding or changing these variables.

### Production-only hard gate

Even if a token is accidentally baked into a non-prod build, the client **refuses to init or capture** unless the page hostname is exactly `bestie.mx` or `www.bestie.mx`. That blocks `dev.bestie.mx`, `localhost`, and Railway preview URLs for events, session replay, heatmaps, web vitals, and error autocapture.

PostHog project `recording_domains` is a second line of defense for replays only (`https://bestie.mx`, `https://www.bestie.mx`).

Organization: **Bestie MX** (`019f71ea-041f-0000-e8d7-cf0412e4fc75`) · Project: **Bestie production** (ID `517444`) · Region: US Cloud · Timezone: `America/Mexico_City`.

> If you add another PostHog project later (e.g. staging), do **not** create a second production-named Bestie project — keep one canonical **Bestie production** and name others clearly (e.g. **Bestie staging**).

## Session replay & privacy

Enabled in project settings (`session_recording_opt_in`, min duration 2s). Client masks all inputs. Mark sensitive DOM with `ph-no-capture` so it never appears in a recording:

- Chat message bodies (`ChatMessageBody`)
- Message attachment thumbs / lightbox
- Listing contact message composer
- Contact / support form fields
- Notification copy (header menu + notifications page)
- Admin user email / phone last-4 and support thread headers

- Watch: https://us.posthog.com/project/517444/replay/home
- Settings: https://us.posthog.com/project/517444/settings/project-replay
- Billing / usage: https://us.posthog.com/organization/billing

Free tier (as of 2026): **5,000 web recordings / month**, resets monthly with the billing period. Overages start ~$0.005/recording unless a billing limit is set. **Set a spend cap** under Organization → Billing (MCP cannot set billing limits) so capture stops instead of charging unexpectedly — $0 or a low per-product cap is recommended for the pilot.

### Friction playlists

Pinned filter playlists for review:

- [Friction — publish failed](https://us.posthog.com/project/517444/replay/playlists/hrz0C2dE)
- [Friction — auth before message](https://us.posthog.com/project/517444/replay/playlists/rfaUkfQc)
- [Friction — dead clicks](https://us.posthog.com/project/517444/replay/playlists/V905r47Y)

## Enabled product features (no surveys)

Surveys are **not** used — Bestie already has in-app feedback/support.

| Feature | Status |
| --- | --- |
| Session replay | On (project + SDK masking) |
| Heatmaps | On (`heatmaps_opt_in`) |
| Dead clicks | On (`capture_dead_clicks`) |
| Error tracking | On (`autocapture_exceptions_opt_in`) |
| Web Vitals | On (`autocapture_web_vitals_opt_in`) |
| Cohorts | Publishers / Messagers / Returned 7d |
| Feature flags | Soft-launch + kill switches (see below) |

### Cohorts

- [Publishers (published once)](https://us.posthog.com/project/517444/cohorts/447843) — `publish_succeeded` in last 90d
- [Messagers (messaged once)](https://us.posthog.com/project/517444/cohorts/447844) — `listing_message_sent` in last 90d
- [Returned visitors (7d)](https://us.posthog.com/project/517444/cohorts/447845) — `$pageview` on ≥2 days in last 7d

### Feature flags

Client helper: `isFeatureEnabled(flag, defaultValue?)` in `src/lib/analytics.ts`.

| Key | Purpose | Default rollout |
| --- | --- | --- |
| [`soft_launch_new_search_ui`](https://us.posthog.com/project/517444/feature_flags/794079) | Soft-launch experimental search UI | 0% |
| [`kill_switch_messaging`](https://us.posthog.com/project/517444/feature_flags/794080) | Emergency disable listing messaging when rolled to 100% + gated in UI | 0% |
| [`kill_switch_publish`](https://us.posthog.com/project/517444/feature_flags/794081) | Emergency disable publish wizard when rolled to 100% + gated in UI | 0% |

Flags are created and ready; wire `isFeatureEnabled('kill_switch_*')` into publish/message entry points only when you want the kill switches live.

### Dashboards

- [Seeker](https://us.posthog.com/project/517444/dashboard/1938827)
- [Publish](https://us.posthog.com/project/517444/dashboard/1938828)

## UX event spine (what we track and why)

We track **decisions and outcomes**, not map pans or every filter chip flicker.

### Acquisition & auth
| Event | Why |
| --- | --- |
| `user_signed_up` / `user_logged_in` | Acquisition channel (`email` / `google` / `facebook`) |
| `user_logged_out` | Session end; pairs with `reset()` |

### Seeker funnel
| Event | Why |
| --- | --- |
| `home_search_submitted` | Top-of-funnel intent from home |
| `search_results_loaded` | Supply density + filter effectiveness |
| `search_filters_changed` / `cleared` | How seekers refine |
| `search_city_selected` / `neighborhood_selected` | Geo demand |
| `search_listing_selected` | Map vs list vs mobile engagement |
| `listing_viewed` | Detail attention |
| `listing_contact_clicked` / `listing_message_sent` | Core conversion |
| `listing_auth_required` | Friction before contact |
| `search_save_clicked` / `search_saved` | Retention intent |
| `search_follow_clicked` / `search_follow_enabled` | Alert activation |
| `search_auth_prompted` | Auth wall on save/follow |

### Publisher funnel
| Event | Why |
| --- | --- |
| `home_cta_clicked` (`publish`) | Entry to supply |
| `publish_mode_selected` | Room vs multi-room property |
| `publish_step_completed` / `publish_step_back` | Wizard drop-off by step |
| `publish_draft_saved` | Progress save |
| `publish_auth_required` | Guest → login gate |
| `publish_succeeded` / `publish_failed` | Publish conversion |

### Retention / supply ops
| Event | Why |
| --- | --- |
| `my_listing_status_changed` | Pause / republish / archive |
| `group_created` / `group_joined` | Communities feature |

Plus automatic `$pageview` on every SPA route change.

## Code map

- Init: `src/lib/posthog.ts`, `src/main.tsx`
- Typed `track()` + flags: `src/lib/analytics.ts`
- Identify + pageviews: `src/components/analytics/PostHogApp.tsx` (in `AppShellLayout`)

## MCP (agent follow-up)

```bash
npx @posthog/wizard mcp add
```

Lets Cursor query PostHog (funnels, HogQL, flags) without leaving the editor. Requires OAuth / personal API key — not needed for client event capture.
