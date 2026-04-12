# BES (Jira) ↔ GitHub `main` coverage

**Canonical repo:** [github.com/enbatose/bestie.mx](https://github.com/enbatose/bestie.mx) · branch **`main`**.

This file is the source of truth for which **BES** issues reflect **merged application code** in this repository. Operational-only tasks (inbox monitoring, etc.) are noted separately.

## Rule

Per [`.cursor/rules/bestie-jira.mdc`](https://github.com/enbatose/bestie.mx/blob/main/.cursor/rules/bestie-jira.mdc), an issue should be **Done** in Jira only after scope is implemented here, committed, and merged to `main`.

## Shipped on `main` (evidence in repo)

| Range | Theme | Primary evidence |
|--------|--------|-------------------|
| **BES-1** | Phase A epic (marketplace hardening) | `server/src/listingsRouter.ts`, `server/src/api.hardening.test.ts`, `server/src/rateLimit.ts`, `src/pages/SearchPage.tsx`, `src/pages/ContactPage.tsx`, `src/pages/LegalPage.tsx`, `src/pages/FaqPage.tsx`, `server/src/session.js`, `server/src/uploadsRouter.ts` |
| **BES-2** | Phase B epic (property + rooms) | `server/src/propertiesRouter.ts`, `server/src/db.ts`, `server/src/types.ts`, `src/pages/PublishWizardPage.tsx`, `src/lib/listingsApi.ts` |
| **BES-5–BES-16** | Phase A–B stories | Same modules as above; publish/search/listing/my listings flows |
| **BES-26–BES-32** | A1–A2 subtasks | Rate limit + session + uploads + CORS path |
| **BES-34–BES-44** | A3–A7 subtasks | Legal/FAQ routes, map bbox (`searchFilters.ts`, `SearchPage`), `MyListingsPage`, filters |
| **BES-45–BES-57** | Phase B subtasks | Property/room API, wizard, lifecycle (`draft`/`published`/`paused`/`archived` in types + routers) |

Representative **merge themes** on `main`: Phase A API hardening + map; Phase B property/room API and publish wizard; publish autosave/uploads (see `git log` on `main`).

## Not shipped in this repo (do not mark Done until merged)

| Range | Theme | Gap |
|--------|--------|-----|
| **BES-3** | Phase C epic | No Meta WhatsApp OTP backend, no email/password auth service, no Messenger webhook, no groups product |
| **BES-4** | Phase D epic | No `/api/admin` routes, admin UI, analytics pipeline, or formal D4 review artifacts in repo |
| **BES-17–BES-21** | Phase C stories | `src/pages/SignInPage.tsx` is UI-only (“sin backend”); no Messenger or groups APIs |
| **BES-22–BES-25** | Phase D stories | No admin console, user directory API, or analytics integration as specified |
| **BES-58–BES-80** | Phase C/D subtasks | Depend on the above; not implemented |
| **BES-33** | Ops: monitor support@ inbox | Not verifiable from repository code |

## Optional / partial

| Key | Notes |
|-----|--------|
| **BES-29** | Anonymous publisher cookie exists (`session.js`); full “spike” doc vs WhatsApp OTP slice may still belong in backlog until explicitly closed with artifacts. |

## Maintenance

When you merge work for a BES issue: (1) add or update rows above, (2) put **`BES-nnn`** in the merge commit subject or body, (3) transition the Jira issue to **Done** after push to `main`.
