# Bestie — product v1 (authoritative summary)

**Brand & domain:** Bestie · **bestie.mx** · **support@bestie.mx**  
**Mark:** ™ while IMPI pending; ® after registration.

## Vision

- Roommate / shared-rent **marketplace for Mexico**; start in **Guadalajara, Mérida, Puerto Vallarta, Sayulita, Bucerías**; expand nationally, later other Spanish-speaking countries.
- **Mobile-first:** fully responsive web with excellent phone UI.

## Differentiators (v1 direction)

- **Facebook Messenger:** search + filter Q&A + result list **in chat**; tap result → **bestie.mx**. **Listing creation** starts in Messenger → **completed on the web app** (photos, map pin, wizard, legal).
- **WhatsApp OTP** via Meta’s supported path for verification; **fallback:** email + password.
- **Property-centric** listings: many **rooms** per property; **status** per property and/or per room: `draft → published → paused → archived`.
- **Whole-property + groups (v1):** groups of compatible people (e.g. age/income criteria) organizing to rent together — required for v1 differentiation.

## Success (90 days)

- **>100 published property listings** (count properties in `published`, not room rows).
- **DAU > 20**.

## Non-goals v1

- No monetization.
- No blog (static marketing + FAQ + markdown legal pages).

## Search & map

- **Mandatory filters v1:** location, budget, tags, gender, age (ship together).
- **Map with pins:** critical for v1.

## Auth & trust

- Primary: **phone + WhatsApp OTP** (not Facebook web login as primary).
- Trust: **good faith** v1 (no ID verification / moderation queues required for launch).

## Messaging & support

- No in-app chat v1; **reveal contact** OK.
- **Support:** route to **support@bestie.mx** (form vs light ticketing — product choice).

## Admin v1

- Listings **auto-approved**; admin can **pause**.
- **Featured cities**, **view users**; **no impersonation**.

## Cron v1

- None required per product input.

## Data

- **Fresh seed** acceptable; new schema and journeys allowed.

## Design tokens (UI)

| Token | Hex | Role |
|--------|-----|------|
| primary | `#143D30` | Brand forest |
| primary-fg | `#FFFFFF` | On primary |
| secondary | `#84CC16` | Lime accent |
| accent | `#6EE7B7` | Mint / focus |
| bg-light | `#F8FAFC` | Page background |
| bg-dark | `#0F172A` | Dark mode base |
| surface | `#FFFFFF` | Cards |
| border | `#E2E8F0` | Borders |
| body | `#1E293B` | Text |
| muted | `#64748B` | Secondary text |
| error | `#E11D48` | Errors |

---

*v1.0 — consolidated from product Q&A and brand handoff.*
