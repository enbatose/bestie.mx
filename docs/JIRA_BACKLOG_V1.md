# Jira backlog — Bestie v1 (from PRODUCT_V1 + repo gap analysis)

Use this in **Jira Cloud** or **Jira Data Center** to create a **Project** (Jira does not use “Space”; that is **Confluence**). Suggested project: **Bestie** · type **Scrum** or **Kanban** · key e.g. **BEST**.

**How to create the container**

1. Jira → **Projects** → **Create project** → choose template (Scrum recommended for epics/sprints).
2. Name: **Bestie v1** · Key: **BEST** (or your convention).
3. Create the **four Epics** below (issue type **Epic**). Set Epic names exactly as below for traceability.
4. For each **User Story**, create a **Story** linked to the Epic (Epic Link / Parent field).
5. Create **Tasks** as children of the Story (sub-tasks) or as linked **Task** issues—your preference.

---

## Epic: BEST-A — Phase A: Marketplace MVP hardening

**Summary:** Close gaps vs a shippable marketplace: trust on writes, support/legal surfaces, map behavior, owner basics.

### Story A1 — Protect listing creation API

**As a** platform owner **I want** public `POST /api/listings` to be abuse-resistant **so that** we avoid spam and junk data.

**Tasks**

- Add **rate limiting** (per IP and/or per device fingerprint header) on `POST /api/listings`.
- Decide v1 policy: **signed upload token** from anon session vs **minimal auth** before POST; document in README.
- Return consistent **429** / error JSON; add server tests or manual test checklist.

### Story A2 — Session / auth stub for publishers (optional v1 path)

**As a** publisher **I want** a minimal identity **so that** my listings can be attributed and edited later.

**Tasks**

- Spike: **anonymous session cookie** vs **WhatsApp OTP** slice (defer full OTP to Phase C if needed).
- If cookie session: issue **publisher_id** on first publish; store on listing row (schema migration).
- Frontend: send credentials/cookie on `fetch` to API; CORS + `credentials` configuration.

### Story A3 — Support contact (support@bestie.mx)

**As a** user **I want** to reach support **so that** I can report issues or ask questions.

**Tasks**

- Add **/contacto** (or footer on all pages): copy + `mailto:support@bestie.mx` and/or embedded form (Formspree, Getform, or backend `POST` that emails).
- Verify **support@bestie.mx** inbox exists and is monitored.

### Story A4 — FAQ and legal pages (static)

**As a** visitor **I want** FAQ and legal text **so that** I trust the product and understand terms.

**Tasks**

- Add routes **`/faq`** and **`/legal`** (or `/terminos`, `/aviso-privacidad` as needed).
- Author markdown (or CMS later); wire **React router** + simple layout.
- Footer links from **AppShellLayout** to FAQ + legal.

### Story A5 — Search when map moves

**As a** searcher **I want** the list to update when I pan the map **so that** I can explore geographically.

**Tasks**

- On **Leaflet `moveend`**, debounce bounds → update URL params or call API with bbox (align with product: “mandatory filters” vs bbox-only mode).
- Define API contract: **`?bbox=minLat,minLng,maxLat,maxLng`** or reuse `q` + client filter; implement chosen approach on **server + client**.
- UX: respect “Buscar al mover el mapa” checkbox; loading state on list.

### Story A6 — Listing status for owners (minimal)

**As a** publisher **I want** to pause my listing **so that** it stops receiving leads without deleting.

**Tasks**

- Extend schema: ensure **`status`** supports `paused` (and `archived` if trivial).
- **`PATCH /api/listings/:id`** with auth check (owner or admin).
- No public UI yet if deferred—document **curl** or minimal “my listing” page under A7.

### Story A7 — “My listings” (minimal)

**As a** publisher **I want** to see listings I created **so that** I can pause or share links.

**Tasks**

- **`GET /api/my-listings`** or filter by `publisher_id` / session.
- Minimal page **`/mis-anuncios`** (table + links + pause action).

---

## Epic: BEST-B — Phase B: Product model (property + rooms)

**Summary:** Align data model and UI with **property-centric** listings and full lifecycle.

### Story B1 — Domain model: Property and Room

**As a** product lead **I want** a normalized model **so that** many rooms per property and per-room state are possible.

**Tasks**

- Design **ERD**: Property, Room, ListingPublication (or equivalent), User/Publisher.
- Migration plan from current **flat `listings`** table; script or dual-write period.
- Update **seed** data to new shape.

### Story B2 — API for properties and rooms

**As a** client **I want** CRUD on properties and rooms **so that** the app can manage real inventory.

**Tasks**

- Implement REST (or GraphQL) endpoints; OpenAPI or README contract.
- Enforce invariants (e.g. at least one room, rent on room vs property—product decision).
- Integration tests against SQLite.

### Story B3 — Search and map use new model

**As a** searcher **I want** search results to reflect rooms or properties **so that** results match the product vision.

**Tasks**

- Update **filter** semantics (price per room vs per property—document).
- Update **SearchPage**, **PropertyMap**, **ListingPage** to new API payloads.
- Performance: indexes for city, bbox, status.

### Story B4 — Publish wizard aligned to property + rooms

**As a** publisher **I want** to add a property and multiple rooms **so that** my inventory is accurate.

**Tasks**

- Multi-step wizard: property → N rooms → photos (stub ok) → legal acknowledgment (checkbox).
- Wire to new API; validation and error display.

### Story B5 — Lifecycle: draft → published → paused → archived

**As a** publisher **I want** full status control **so that** I can manage listing lifecycle.

**Tasks**

- State machine in API; forbid invalid transitions.
- UI badges and actions on **Listing** + **My listings**.

---

## Epic: BEST-C — Phase C: Differentiators (auth + channels + groups)

**Summary:** WhatsApp OTP, email fallback, Messenger handoff, groups (large scope—split sprints).

### Story C1 — WhatsApp OTP (Meta)

**As a** user **I want** to sign in with WhatsApp OTP **so that** I don’t need a password.

**Tasks**

- Meta **WhatsApp Business** / Cloud API spike; secure token storage.
- Backend: **request code**, **verify code**, issue **session/JWT**.
- Frontend: replace **SignIn** stub with real flow; error states.

### Story C2 — Email + password fallback

**As a** user **I want** email login **so that** I can access the product without WhatsApp.

**Tasks**

- Choose provider (Auth0, Cognito, custom) vs minimal bcrypt in DB.
- Registration, login, reset password, email verification (product decision on strictness).

### Story C3 — Facebook Messenger entry

**As a** prospect **I want** to search inside Messenger **so that** discovery matches the v1 differentiator.

**Tasks**

- Meta **Messenger Platform** app; webhook endpoint (new service or route namespace).
- Intent mapping: location, budget, tags → deep link **`bestie.mx/buscar?...`**.
- Analytics: count Messenger-sourced sessions.

### Story C4 — Messenger → web listing completion

**As a** publisher **I want** to continue a listing started in Messenger **so that** I finish photos and legal on the web.

**Tasks**

- Design **handoff token** or user binding; TTL and security review.
- Web route **`/publicar?continue=...`** loads draft from API.

### Story C5 — Groups (rent together)

**As a** renter **I want** to form a compatible group **so that** we can pursue whole-property rentals.

**Tasks**

- Product spec workshop: matching rules, caps, moderation “good faith”.
- Data model: Group, GroupMember, criteria (age/income).
- MVP UI: create group, invite link, list open groups (scope control).

---

## Epic: BEST-D — Phase D: Growth & ops

**Summary:** Admin, analytics, operational readiness.

### Story D1 — Admin console (minimal)

**As an** admin **I want** to pause any listing and set featured cities **so that** I can operate the marketplace.

**Tasks**

- Auth: **admin role** (env allowlist or separate IdP group).
- **`PATCH` listings** (pause), **featured cities** config (DB or env).
- Minimal UI (could be separate **/admin** Vite route or server-rendered).

### Story D2 — View users (read-only)

**As an** admin **I want** a read-only user list **so that** I can support tickets.

**Tasks**

- **`GET /api/admin/users`** paginated; PII policy documented.
- Admin UI table + export CSV optional.

### Story D3 — Analytics for v1 success metrics

**As a** stakeholder **I want** published property count and DAU **so that** we track the 90-day goals.

**Tasks**

- Define **“published property”** count query on new model (Phase B) or interim definition on flat listings.
- Instrument **DAU** (privacy-friendly: Plausible, PostHog, or internal heartbeat).
- Dashboard or weekly automated report.

### Story D4 — No impersonation guarantee

**As a** security reviewer **I want** admin never impersonating users **so that** we meet the explicit non-goal boundary.

**Tasks**

- Document in admin spec; code review checklist; no “login as user” feature.

---

## Optional Jira fields (recommended)

| Field | Use |
|-------|-----|
| **Component** | `web`, `api`, `infra`, `integrations` |
| **Labels** | `phase-a`, `phase-b`, …, `product-v1`, `debt` |
| **Priority** | Phase A stories **High**; C5 groups **Medium/Low** until spec locked |

---

## Dependency note

- **B** depends on **A** (especially schema + auth decisions).
- **C1–C2** can start in parallel with late **A** if team capacity allows; **C3–C4** need stable web URLs and listing drafts.
- **D** depends on **A** (admin pause) and ideally **B** (correct counting of “properties”).

---

*v1.0 — generated from `docs/PRODUCT_V1.md` and current repo capabilities.*
