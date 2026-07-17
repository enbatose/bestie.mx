# Bestie × PostHog analytics

Product analytics for usage behavior. Client SDK: `posthog-js` + `@posthog/react`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_POSTHOG_PROJECT_TOKEN` | Project token (`phc_…`) — public, browser-safe |
| `VITE_POSTHOG_HOST` | Ingestion host (US: `https://us.i.posthog.com`) |

Set these in `.env.local` (local) and in the **production build** environment (Vite inlines `VITE_*` at build time).

Organization: `019f71ea-041f-0000-e8d7-cf0412e4fc75` · Project ID: `517444` · Region: US Cloud.

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
- Typed `track()`: `src/lib/analytics.ts`
- Identify + pageviews: `src/components/analytics/PostHogApp.tsx` (in `AppShellLayout`)

## MCP (agent follow-up)

```bash
npx @posthog/wizard mcp add
```

Lets Cursor query PostHog (funnels, HogQL, flags) without leaving the editor. Requires OAuth / personal API key — not needed for client event capture.
