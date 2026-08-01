# Facebook groups inventory — GDL roomies (search)

Source: Facebook search `roomies gdl` with Guadalajara filter, copied from the personal-account UI on **2026-08-01**.

Canonical data: [`facebook-groups-gdl-roomies.csv`](./facebook-groups-gdl-roomies.csv)  
Raw paste: [`_raw-roomies-gdl-paste.txt`](./_raw-roomies-gdl-paste.txt)  
Regenerate CSV: `node docs/gtm/parse-roomies-gdl-inventory.mjs`

This inventory is the working list for Bestie go-to-market outreach (group-by-group). It is **not** a complete list of every group either account belongs to — only what that search returned.

## Snapshot

| Metric | Count |
| --- | ---: |
| Groups in paste | **163** |
| In coverage (member or join requested) | **55** |
| Tier A — roomies / cuartos / students | **54** |
| Tier A still to join | **0** |
| Tier B — general rentals (casas/depas) | **77** |
| Tier C — sales-heavy / short-stay / other | **8** |
| Tier D — off-topic or reputation-only | **24** |

*(Exact tier counts live in the CSV `relevance_tier` column; re-run the parser after new pastes.)*

Membership: originally inferred from Facebook UI signals (`Miembro desde…`, unread counts, `Perteneces a este grupo`). On **2026-08-01** the user joined or requested all **21** Tier A gaps; see [`membership-overrides.json`](./membership-overrides.json). Private groups may still be pending admin approval — treat as in-coverage for planning.

## Relevance tiers (for Bestie)

| Tier | Meaning | GTM use |
| --- | --- | --- |
| `A_roomies_cuartos` | Rooms, roomies, students, foráneos, campus | **Primary** — publisher + seeker density |
| `B_general_rentals` | Whole-home rentals ZMG | Secondary — landlords who may also list rooms |
| `C_sales_heavy` / `C_short_stay` / `C_other` | Sales, Airbnb/hotels, unclear | Low priority / skip initially |
| `D_off_topic` | Jobs, furniture, bodegas, locales, rides, etc. | Skip |
| `D_reputation_not_supply` | e.g. Malos Roomies Gdl | Do **not** pitch inventory; optional brand hygiene only |

## Wave 1 — Tier A coverage (largest first)

All Tier A groups from this search are now in coverage (member or join requested). Prioritize publics with confirmed **IR**; privados may still be pending.

| ~Members | Privacy | Group |
| ---: | --- | --- |
| 212k | Público | Busco Roomies, Comparto Depa, Renta de Cuartos Guadalajara, Roomie GDL |
| 136k | Público | Roomies Guadalajara / roomie GDL / Habitaciones en renta / Cuartos en renta |
| 124k | Público | Guadalajara Renta de casas , cuartos y departamentos en zona metropolitana |
| 90k | Público | Roomies y cuartos en renta GDL |
| 84k | Privado | Roomies y cuartos en renta en Guadalajara |
| 74k | Público | renta de cuartos guadalajara |
| 71k | Privado | Rentas GDL-ZAPOPAN-CUARTOS Y RENTAS-Exchange Student Guadalajara - Foráneos |
| 69k | Público | Habitaciones o cuartos en guadalajara jalisco |
| 67k | Público | Renta de Cuartos en Guadalajara y Zapopan |
| 67k | Privado | ROOMIES VIP GUADALAJARA - Renta cuartos Andares Chapu Providencia Chapalita |
| 67k | Público | Cuartos y Roomies ZMG (Gdl, Zapopan, Tlaquepaque) - Corto y Largo Plazo |
| 57k | Privado | BUSCO ROOMIE GDL, RENTA DE CUARTOS GDL, RENTA CASAS GDL, COMPARTO DEPA GDL, |
| 51k | Público | ROOMIES-ROOMMATES GUADALAJARA (Busca,ofrece,comparte depa o casa) |
| 39k | Público | Roomies Guadalajara 2026 Chapultepec -Centro -Americana |
| 32k | Público | Renta Cuartos y habitaciones en Guadalajara para jóvenes |
| 27k | Público | Roomies VIP Guadalajara |
| 24k | Privado | Roomies GDL |
| … | … | +16 more Tier A memberships in the CSV (`is_member=yes`) |

## Wave 2 — join queue (Tier A) — DONE 2026-08-01

All **21** Tier A gaps were joined or join-requested. Coverage for Tier A is complete for planning (private approvals may still be pending).

## Suggested sequencing (for next strategize session)

1. **Wave 1 outreach** — comment from personal account on landlord room posts across Tier A (start with largest + campus niches).
2. **Check private approvals** — confirm IR (not pending) on privados before relying on them for volume.
3. **Bestie Page** — only after testing which groups allow Page posts/comments; many roomies groups restrict Pages.
4. **Tier B** — after Tier A is saturated; treat as landlord pools, not roomie-native.
5. **Skip Tier D** for supply recruitment.

## Fields in the CSV

`id`, `name`, `privacy`, `members_approx`, `members_label`, `activity`, `friends_in_group`, `is_member`, `member_since`, `unread_signal`, `recent_members_signal`, `relevance_tier`, `search_query`, `source_date`, `account_observed`, `notes`

## Caveats

- Duplicate-looking names with different sizes/privacy are kept as separate rows (Facebook often has near-clones).
- Member counts are Facebook’s rounded labels (`mil`), converted to approx integers.
- Search bias: results skew toward “roomies gdl”; other queries (`cuartos zapopan`, `roomie iteso`, etc.) will add inventory later.
- Company Page membership is **not** in this dump — only personal-account search UI.

## Next inputs that improve the plan

- Toggle **Mis grupos** and paste that list (true membership inventory).
- Same search while logged in as / viewing as the Bestie Page.
- Extra search pastes: `cuartos gdl`, `roomie zapopan`, `roomies iteso`, `roomies tec gdl`.
