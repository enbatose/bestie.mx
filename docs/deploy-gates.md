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

### Local / manual

```bash
npm run smoke:dev
npm run smoke:prod
node scripts/smoke-deploy.mjs https://dev.bestie.mx
```

## Promoting security fixes

1. Push to `develop` → CI green → smoke against Dev green  
2. Merge `develop` → `main` → CI green → smoke against Prod green  
