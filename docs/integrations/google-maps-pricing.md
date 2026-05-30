# Google Maps Platform — Bestie Street View pricing

**Canonical source (keep updated):** [Google Maps Platform pricing list](https://developers.google.com/maps/billing-and-pricing/pricing)

**Last verified:** 2025-05-30

**Code constants:** [`server/src/googleMapsPricing.ts`](../../server/src/googleMapsPricing.ts) — update `GOOGLE_MAPS_PRICING_LAST_VERIFIED` and numeric values when Google changes pricing.

## SKUs Bestie uses

| SKU | Google ID | Bestie usage | Free tier | Paid (first tier) |
|-----|-----------|--------------|-----------|-------------------|
| Dynamic Street View | `658E-F885-E11A` | Publish wizard POV lock (`StreetViewPovEditor`) | 5,000 sessions / month | **$14.00 / 1,000** (~$0.014/session) |
| Maps Embed | `9C10-8313-F21F` | Public/preview Street View iframes | Unlimited | $0 |
| Street View Metadata | `3168-48A9-5C8C` | `getPanorama` availability check in wizard | Unlimited | $0 |

## Overage formula (Dynamic Street View)

After the monthly free cap:

```
billableOverage = max(0, sessions - 5000)
estimatedUsd = billableOverage / 1000 * 14.00
```

Examples:

| Sessions / month | Est. overage USD |
|------------------|------------------|
| 5,000 | $0 |
| 6,000 | ~$14 |
| 10,000 | ~$70 |

Volume discounts apply above 100,000 sessions/month (unlikely early on). See the canonical source for tier tables.

## Internal session counter

Bestie records Dynamic Street View loads via `POST /api/analytics/event` (`dynamic_street_view_session`). The admin **Métricas** tab shows monthly totals and estimated cost from the constants above. **Reconcile with GCP Billing** monthly — Google's invoice is authoritative.

Locked embed views (`street_view_embed_locked`) are tracked for ops visibility only; Embed API is free.

## Refresh checklist (quarterly)

1. Open the [canonical pricing page](https://developers.google.com/maps/billing-and-pricing/pricing).
2. Confirm Dynamic Street View free cap and `$ / 1,000` for the first paid tier.
3. Update this doc's **Last verified** date.
4. Update `server/src/googleMapsPricing.ts` if values changed.

## Production deployment (Railway)

- Set **`VITE_GOOGLE_MAPS_EMBED_KEY`** on the Railway service **before build** (Dockerfile runs `npm run build`; Vite bakes `VITE_*` at build time). The [`Dockerfile`](../../Dockerfile) declares `ARG VITE_GOOGLE_MAPS_EMBED_KEY` so Railway passes the service variable into the build stage — **redeploy after adding or changing the variable**.
- GCP API key **Application restriction:** Websites (HTTP referrers), e.g.:
  - `http://localhost:5173/*`, `http://127.0.0.1:5173/*` (local dev)
  - `https://bestie.mx/*`, `https://www.bestie.mx/*`
  - Your Railway hostname if used, e.g. `https://*.up.railway.app/*`
- GCP **API restriction:** Maps JavaScript API + Maps Embed API only.
- Optional: GCP budget alert (e.g. $10/month).
