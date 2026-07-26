# Publisher hub principles (Mis Anuncios)

Distilled from the current `/mis-anuncios` implementation (`MyListingsPage.tsx`, `ListingPropertyCard.tsx`, `listingCardChrome.tsx`) for **mobile and desktop**. Use this when redesigning other management UIs — and when deciding **what not to copy**.

**Figma home:** [Bestie.mx — Design System](https://www.figma.com/design/JVO8AoBQ5FJqfvtJXCe6Mv/Bestie.mx-%E2%80%94-Design-System) → `Principles / Publisher Hub` + `Components / Publisher`  
**Cursor skill:** `.cursor/skills/publisher-hub-ui/SKILL.md`  
**Brand constraints:** `.cursor/rules/bestie-brand.mdc`

---

## 1. Jobs to be done (this surface)

| JTBD | User need | UI answer in Mis Anuncios |
| --- | --- | --- |
| **Inventory scan** | “What do I have, and in what state?” | Status tabs with counts + one-line inventory summary |
| **Lifecycle control** | “Turn this offer on or off without hunting menus” | Header On/Off for publication; confirm when Off cascades |
| **Slot management** | “Which rooms are for rent vs lived-in?” | Rooms accordion + occupancy badge + room On/Off |
| **Finish & publish** | “What’s blocking go-live?” | Missing-fields callout + legal checkbox + full-width Publicar |
| **Operate** | “View, edit, share, archive” | Action group: icon-cluster (mobile) / labeled pills (`sm+`) |
| **Performance** | “Is anyone looking / messaging?” | Quiet metric chips (vistas · mensajes → inbox) |
| **Find one item** | “Where is that colonia / rent?” | Pill search above tabs; empty state can jump to another tab |

These JTBD define the **publisher inventory hub** pattern. Other hubs (saved searches, mensajes, account) share only the **reusable** principles below.

---

## 2. Reusable principles (apply elsewhere)

### P1 — One composition, two densities

Ship **one card component** for mobile and desktop. Adapt density and action chrome with breakpoints — do not maintain separate “mobile card” / “desktop row” products unless the jobs diverge.

- Mobile: connected icon action strip (`CardActionGroup` `sm:hidden`).
- Desktop (`sm+`): separate labeled pills.
- Shared: header stack, badges, toggle, photo+ref, metrics.

### P2 — Status segmentation with counts

Inventory hubs use **underline tabs** (not segmented pills) when the primary job is switching lifecycle buckets:

- Active tab: `border-primary text-primary` + count chip `bg-primary/10`.
- Inactive: muted + neutral count chip.
- Horizontal scroll on narrow widths; hide scrollbars.
- Prefer a **sensible default tab** once data loads (published → draft → archived).

Reuse for any list that has mutually exclusive buckets with meaningful counts. Prefer **search advanced sheet** segment tabs when the job is filter facets, not lifecycle.

### P3 — Binary control on the header line

Put the **primary binary state control** on the same row as status badges, right-aligned, height-matched to the badge row (`h-8` card / `h-7` nested).

- Filled track = entity “live” (publication).
- Outlined track = nested slot state (availability).
- Accessible `role="switch"` + Spanish `aria-label` describing **what On and Off do**, not just “toggle”.

### P4 — Tone = entity type, not decoration

When a hub manages two related entity kinds, encode tone in:

- Left border accent (`border-l-4` + forest vs lime).
- Type badge fill.
- Action chip tint.

Do not invent a third accent. Forest (`primary`) = multi-unit / parent; lime (`secondary`) = single unit / child. Match Bestie brand CTA tree for actual buttons.

### P5 — Progressive disclosure for nested inventory

Parents that contain many children use an **accordion** (Recámaras) rather than always-expanded lists. Nested rows:

- Lead with occupancy/state badge + title.
- Put the nested On/Off + photo/ref in a right column aligned to the badge line.
- Use **compact** action groups.
- Omit photo placeholders when there is no image — show quiet reference only.

### P6 — Feedback without stealing the page

- Success: fixed flash toast — bottom safe-area on mobile, top-right under chrome on large screens (`z-[1800]`). Optional deep link in the message.
- Errors: inline on the card (`role="alert"`) for local failures; page-level alert for load failures.
- Confirm dialogs for irreversible or **cascading** Off actions (`AppConfirmDialog`, danger for archive).

### P7 — Empty and search as guidance, not dead ends

Empty tab / empty search states:

1. One clear sentence of what is missing.
2. One secondary sentence of what to do next.
3. One CTA — either create, clear search, or **jump to the other tab that has matches**.

### P8 — Quiet owner metrics

Owner-only performance is **metadata**, not a dashboard:

- `Eye` + count, `MessageSquare` + count (same icon as Mensajes nav).
- Messages link into the filtered inbox with return state.
- Summed metrics on parents; per-room on children.

### P9 — Preserve hub return context

Any navigation out of the hub (edit wizard, public preview, mensajes, legal) should carry **return state** so the user can come back to Mis Anuncios without losing place. Pattern: `myListingsReturn` / `MyListingsReturnLink`.

### P10 — Completeness gates before irreversible publish

When publish has prerequisites, show them **on the card** (callout list + legal acknowledgement) rather than only failing after submit. Primary publish CTA disabled/blocked with an inline explanation.

---

## 3. JTBD-specific (do not copy blindly)

| Pattern | Why it fits Mis Anuncios | When **not** to reuse |
| --- | --- | --- |
| Publication vs occupancy split | Property status ≠ room offered-for-rent | Simple single-status objects (e.g. one saved search) |
| Paused inline under Publicados | Pause is temporary; archiving is the real shelf | Domains where pause deserves its own bucket |
| Legal checkbox on draft card | Publish has ToS obligation | Non-publish management lists |
| Room activation modal | Incomplete rental fields before “available” | Edits that can always save as draft |
| Pause property → mark rooms occupied | Product rule: no published property with zero availability | Hierarchies without that invariant |
| Reference codes under thumbs (`P…` / `A…`) | Support / sharing identity for listings | Objects without human-facing refs |
| Search over title · colonia · ciudad · renta | Publisher inventory language | Inboxes / threads may need different query UX |
| Draft warning panel + full-width Publicar | High-stakes go-live | Routine “save” actions |

---

## 4. Layout anatomy (both viewports)

```
Page (max-w-4xl → xl:max-w-6xl)
├── Greeting (optional) + H1 + secondary CTA “Publicar anuncio”
├── Inventory summary line (counts · joined)
├── [Flash toast — portal-like fixed]
├── Search pill
├── Underline tabs + count chips
└── Card stack (space-y-6)
    └── ListingPropertyCard
        ├── Badges + On/Off
        ├── Title / place / details + PhotoWithReference
        ├── [MissingFields + legal + Publicar] if draft
        ├── Action group [+ Recámaras]
        └── Rooms accordion (property only)
```

**Spacing:** page `px-4 sm:px-6`, card `p-4`, nested room `px-4 py-3`, touch targets `min-h-11` on primary actions / tab hits.

---

## 5. Component inventory (Figma ↔ code)

| Figma name | Code | Reuse tier |
| --- | --- | --- |
| `Publisher / StatusBadge` | `ListingStatusBadge.tsx` | Reusable |
| `Publisher / TypeBadge` | `ListingTypeBadge` | Publisher hubs |
| `Publisher / OccupancyBadge` | `RoomOccupancyBadge` | Nested slot UIs |
| `Publisher / OnOffToggle` | `CardOnOffToggle` | Reusable binary control |
| `Publisher / RoomOnOffToggle` | `RoomOnOffToggle` | Nested slot UIs |
| `Publisher / ReferenceChip` | `ListingReferenceChip.tsx` | Reusable |
| `Publisher / MetricChips` | `PublisherMetricChips.tsx` | Owner hubs |
| `Publisher / MissingFieldsCallout` | `MissingFieldsCallout.tsx` | Completeness gates |
| `Publisher / CardAction` + `CardActionGroup` | `listingCardChrome.tsx` | Reusable |
| `Publisher / PhotoWithReference` | `PhotoWithReference` | Listing identity |
| `Publisher / ListingPropertyCard` | `ListingPropertyCard.tsx` | Publisher organism |
| `Hub / StatusTabs` | tablist in `MyListingsPage` | Reusable hub chrome |
| `Hub / FlashToast` | flash banner in `MyListingsPage` | Reusable |

---

## 6. Anti-patterns learned here

- Separate desktop table vs mobile cards for the **same** JTBD.
- Repeating “Publicado” on every room when publication is property-level.
- Showing empty photo boxes for rooms without images.
- Gold CTA on this hub (reserved for Save search — brand rule).
- Infinite attention animations on inventory controls.
- English labels / Title Case on Spanish management UI.

---

## 7. Checklist for redesigning another UI

1. Name the JTBD — inventory, conversation, settings, or creation?
2. Apply **P1–P10** only where the job matches.
3. Pull atoms from `Components / Publisher` / existing DS; do not restyle hex.
4. Keep Mis Anuncios–specific rules (occupancy, legal gate, cascade pause) out unless the domain has the same product invariants.
5. Verify mobile action density and desktop labeled actions on the **same** component.
6. Confirm layering for toasts/dialogs (`.cursor/rules/ui-layering-precedence.mdc`).
