# Bestie (`bestie.mx`)

Greenfield web app for the **Bestie** roommate / shared-rent marketplace in **Mexico** (initial metros: Guadalajara, Mérida, Puerto Vallarta, Sayulita, Bucerías).

## Stack

- **Vite 6** + **React 19** + **TypeScript**
- **Tailwind CSS** with design tokens aligned to `docs/PRODUCT_V1.md` (forest / lime / mint palette)

## Run locally

```bash
cd bestie.mx
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5173**).

```bash
npm run build   # production bundle → dist/
npm run preview # serve dist locally
```

## Repo / GitHub

Create the remote **bestie.mx** on GitHub, then:

```bash
git init
git add .
git commit -m "Initial Bestie web scaffold"
git branch -M main
git remote add origin https://github.com/<you>/bestie.mx.git
git push -u origin main
```

## Product source of truth

See **`docs/PRODUCT_V1.md`** for v1 scope (map, filters, property/room model, Messenger handoff, WhatsApp OTP, groups, admin, non-goals).

## API (`server/`) — local

```bash
cd bestie.mx
npm install
npm install --prefix server
npm run server:dev
```

Default **http://localhost:3000**. Point the web app at it with `VITE_API_URL` (see `scripts/write-env-local.mjs`).

### Listing writes — v1 security model

- **Publisher identity:** first successful `POST /api/listings` or `POST /api/properties/publish-bundle` sets an **httpOnly** cookie `bestie_pub` (UUID). That id is stored as `publisher_id` on **properties**. It is **not** a full account system; clearing cookies starts a new publisher id. WhatsApp OTP is planned later (Phase C).
- **Rate limiting:** `POST /api/listings` and `POST /api/properties/publish-bundle` share the same per-IP / device limit. Tune with `RATE_LIMIT_POST_LISTINGS_MAX` and `RATE_LIMIT_POST_LISTINGS_WINDOW_MS` (defaults: 30 requests / hour per key).
- **Errors:** validation failures return `{ "error": "<code>" }`. Rate limit returns **429** with `{ "error": "rate_limited", "retryAfterSec": number }` and a `Retry-After` header.
- **CORS:** `CORS_ORIGINS` must list the exact SPA origins; the API uses **`credentials: true`**, so the browser sends cookies on `fetch` when the SPA uses `credentials: "include"` (already wired in `src/lib/listingsApi.ts`).

### Owner endpoints

- `GET /api/my-listings` — requires `bestie_pub` cookie; returns **room rows** (joined with property) for all statuses owned by that publisher.
- `PATCH /api/listings/:id` — updates **room** `:id` (same id as in search). Body `{ "status": "published" | "paused" | "archived" }`; only the owning publisher may update. Valid transitions: `draft→published`, `published↔paused`, `published|paused→archived`.

### Phase B — property + rooms (normalized SQLite)

- **Schema:** `properties` (title, city, geo, contact, `property_kind`, `publisher_id`, lifecycle) and `rooms` (rent, tags, preferences, room lifecycle, `property_id` FK). Each **search row / map pin** is a **room**; `PropertyListing.id` in JSON is always the **room id**.
- **Migration:** if a legacy `listings` table exists, rows are split into `prp__{listingId}` + room `id = {listingId}`, then `listings` is dropped.
- **`GET /api/properties/:id`** — property plus rooms (non-owners see only published rooms on published properties).
- **`POST /api/properties/publish-bundle`** — body `{ "legalAccepted": true, "property": { ... }, "rooms": [ ... ] }` (≥1 room); creates a **published** property and rooms in one transaction.
- **`POST /api/properties`** — create draft property; **`POST /api/properties/:id/rooms`** — add draft room; **`PATCH /api/properties/:id`** — update property fields/status; pausing or archiving cascades to rooms; republishing a paused property sets paused rooms back to published.

**Hardening (Phase B):** request validation (string max lengths, WhatsApp 10–15 digits, lat/lng bounds, rent/spots clamps), safe id patterns on routes, **rate limit** on `POST /api/properties` and `POST /api/properties/:id/rooms` (same bucket as publish-bundle / flat listing POST), **invariants** — cannot `PATCH` a room to `published` until its property is `published`; cannot set a **draft** property to `published` without at least one room. Integration tests in `server/src/api.hardening.test.ts` (supertest + temp SQLite).

**Client parity:** wizard sends **property kind**, optional **custom map pin**, per-room **tags / lodging type / gender pref / age range**; **“Guardar borrador en servidor”** uses `POST /api/properties` + `POST …/rooms`, then **Mis anuncios** can **publish the property** (with legal checkbox); publishing a draft property **cascades** all draft rooms to `published`. Owners can **GET `/api/listings/:id`** for non-public room rows (same publisher cookie). Listing detail shows **property summary** when loaded from `GET /api/properties/:id`.

### Search bbox

- Optional query: **`?bbox=minLat,minLng,maxLat,maxLng`** (same semantics on client and server). Used when “Buscar al mover el mapa” is enabled on `/buscar`.

### Support inbox

- **support@bestie.mx** is referenced in UI (`/contacto`, footer). Ensure DNS + mailbox exist for production.

## Next implementation slices

1. **Router + layouts** (e.g. React Router), auth shell, protected routes  
2. **Map** (Mapbox or Google) with pins + list sync  
3. **Search API** + filter state (location, budget, tags, gender, age)  
4. **Publication wizard** with autosave + property/room statuses  
5. **Backend** (Laravel 11 API or Node) — this repo can stay SPA or move to monorepo `apps/web`
