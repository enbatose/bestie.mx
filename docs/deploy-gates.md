# Deploy gates (CI + smoke)

Bestie uses two automated gates so broken changes do not stay on Dev/Prod unnoticed.

## 1. Pre-merge / pre-deploy unit gate — `CI` workflow

**File:** `.github/workflows/ci.yml`

Runs on every push and pull request to `develop` and `main`:

- Server Vitest suite (`npm test --prefix server`) — includes security hardening tests
- Frontend Vitest suite (`vitest run --dir src`)

**Best practice:** In GitHub → Settings → Branches, require the **Unit & API tests** check
before merging into `develop` and `main`. Railway still auto-deploys on push; the required
check prevents merging (and therefore deploying) red commits when you use PRs.

## 2. Post-deploy smoke gate — `Deploy smoke` workflow

**File:** `.github/workflows/smoke.yml`  
**Script:** `scripts/smoke-deploy.mjs`

After CI succeeds on `develop` or `main`, smoke hits the live origin:

| Branch | URL |
| --- | --- |
| `develop` | https://dev.bestie.mx |
| `main` | https://www.bestie.mx |

### What it checks (no user-visible dummy data)

- `/health` and `/api/health` (health must not leak SMTP/DB diagnostics)
- SPA shell loads
- `GET /api/listings` returns an array
- Public listing/property JSON does **not** include `publisherId`
- Anonymous `/api/auth/me` responds sanely
- `POST /api/uploads` **rejects** SVG (no file persisted as a listing)
- Location search responds

It never registers accounts, never publishes listings, and never creates drafts that appear in search.

After the core smoke, `scripts/smoke-messaging.mjs` always checks:

- `/mensajes` SPA shell
- Anonymous `/api/messages/*` → **401** (not 5xx)
- `POST /api/messages/conversations/from-listing` anonymous, including a public **A-ref** when the catalog has listings → **401** (the live bug that returned `not_found`)
- `GET /api/listings/:id` works for both UUID and `A…` slug

Optional **authenticated** seeker↔publisher send/receive (no new listings or accounts) runs only when these GitHub Actions secrets are set:

| Secret | Role |
| --- | --- |
| `SMOKE_MSG_SEEKER_EMAIL` / `SMOKE_MSG_SEEKER_PASSWORD` | Seeker fixture |
| `SMOKE_MSG_PUBLISHER_EMAIL` / `SMOKE_MSG_PUBLISHER_PASSWORD` | Publisher fixture |
| `SMOKE_MSG_LISTING_ID` | UUID or `A…` slug **owned by the publisher** |

Use dedicated fixture accounts so live probes never message a real landlord.

### Local / manual

```bash
npm run smoke:dev            # core smoke + messaging contract
npm run smoke:prod
npm run smoke:messaging:dev  # messaging only
npm run smoke:messaging:prod
node scripts/smoke-deploy.mjs https://dev.bestie.mx
```

## 3. Playwright end-to-end — `CI` job `Playwright E2E`

**Folder:** `e2e/` · **Config:** `playwright.config.ts`

Runs after unit tests in CI against an **isolated local stack** (`scripts/e2e-serve.mjs`):

- Temporary SQLite DB with demo seed
- Never uses Dev/Prod databases
- Drafts created in tests stay unpublished (not in `/api/listings`)
- **Every default-suite flow runs twice:** Desktop Chrome **and** Mobile Chrome (Pixel 5 — touch, narrow viewport). Bestie’s primary UX is mobile; the mobile project also asserts the search **Listados** drawer open/close.

### Flows covered

| Spec | Flow |
| --- | --- |
| `browse.spec.ts` | Home, `/buscar/gdl`, open a seeded listing detail; on mobile, open/close the list drawer |
| `auth.spec.ts` | Register → verify screen → logout → login |
| `publisher-draft.spec.ts` | Create **draft** via API, see it in Mis anuncios, assert not public; wizard shell loads |
| `messaging.spec.ts` | Two-user listing chat: publish → contact via `/anuncio/A…` → safety notice → reply; cannot-message-self; anonymous login gate; API A-ref / draft / Soporte |
| `public-pages.spec.ts` | FAQ, Terms, Privacy |
| `live-readonly.spec.ts` | Optional read-only against Dev (`npm run test:e2e:live-dev`) — no writes; also desktop + mobile |
| `messaging-live.spec.ts` | Optional live seeker↔publisher UI using fixture accounts (`npm run test:e2e:messaging-live-dev`) |
| `posthog-publish.spec.ts` | Publish surfaces (`/publicar`, `/borrador`): **no** PostHog network on local/Dev; **yes** on Prod (`npm run test:e2e:live-prod`) |

### Local

```bash
npx playwright install chromium
npm run test:e2e
npm run test:e2e -- --project="Mobile Chrome"   # mobile only
npm run test:e2e:ui
npm run test:e2e:live-dev   # read-only + PostHog silent on https://dev.bestie.mx
npm run test:e2e:live-prod  # PostHog active on https://www.bestie.mx (read-only)
npm run test:e2e:messaging-live-dev   # fixture-account UI chat on Dev
```

### PostHog gate (publish flows)

Unit tests in `src/lib/posthog.test.ts` and `src/lib/publishCreateFlow.test.ts` lock:

- Only `bestie.mx` / `www.bestie.mx` may enable PostHog (Dev never records)
- `create_flow` mapping for AI / Sin IA (`manual`) / assisted claim

Post-deploy smoke (`scripts/smoke-deploy.mjs`) also hits `/publicar` and `/borrador/:token` SPA shells and asserts the origin’s PostHog host policy (prod vs non-prod).
