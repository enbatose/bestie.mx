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

## Wave 1 — Tier A coverage (ranked by posts/day, then size)

All Tier A groups from this search are now in coverage (member or join requested). Rank: **more posts/day first**, then larger membership. Prioritize publics with confirmed **IR**; privados may still be pending.

Facebook often hides posts/day for groups you already belong to (shows unread instead), so many large Tier A rows have **—** for activity in this dump.

| Posts/day | ~Members | Privacy | Group |
| ---: | ---: | --- | --- |
| 30+ | 34k | Público | FORANEOS EN GUADALAJARA |
| 30+ | 6.7k | Público | RENTA DE CUARTOS GUADALAJARA |
| 30+ | 5.1k | Público | renta cuartos tonala guadalajara zap tlaq tlajo el salto |
| 20+ | 102k | Privado | Renta de vivienda / Rooms for rent GUADALAJARA Y ZONA METROPOLITANA |
| 20+ | 9.5k | Privado | Casas Departamentos Locales en JALISCO \| Venta Renta \| Guadalajara \| Roomie |
| 20 | 2.9k | Público | Renta de Habitaciones TEC, UP, Cuauhtémoc, UVM campus GDL |
| 10+ | 42k | Privado | Renta Cuarto o Depa, Zona Real, Chapalita, Providencia, GDL, Jalisco Mexico |
| 10+ | 9.6k | Público | Renta de cuartos en Guadalajara centro |
| 10+ | 8.5k | Público | RENTA CUARTOS CASAS OFICINAS LOCALES COMERCIALES EN GUADALAJARA JALISCO |
| 10+ | 2.9k | Público | ROOMIES RENTA DE CUARTOS ITESO Y UVM |
| 10+ | 2.7k | Público | Renta de Cuarto Habitacion en Guadalajara Jalisco ZMG Romiee GDL |
| 6 | 434 | Público | Busco Roomies, Comparto Depa, Renta de Cuartos Guadalajara, Roomie GDL *(small clone)* |
| 5 | 3.2k | Público | Foráneos en Guadalajara |
| 5 | 1.4k | Público | Renta de Cuartos.. Providencia Guadalajara. |
| 4 | 6.3k | Público | Hospedaje GDL Students (Accommodation) |
| 4 | 3.3k | Público | BuscoCuarto.com - Guadalajara, Zapopan |
| 3 | 2.3k | Público | Rentas para estudiantes en Guadalajara y alrededores |
| — | 212k | Público | Busco Roomies, Comparto Depa, Renta de Cuartos Guadalajara, Roomie GDL |
| — | 136k | Público | Roomies Guadalajara / roomie GDL / Habitaciones en renta / Cuartos en renta |
| — | 124k | Público | Guadalajara Renta de casas , cuartos y departamentos en zona metropolitana |
| — | 90k | Público | Roomies y cuartos en renta GDL |
| — | 84k | Privado | Roomies y cuartos en renta en Guadalajara |
| — | 74k | Público | renta de cuartos guadalajara |
| — | 71k | Privado | Rentas GDL-ZAPOPAN-CUARTOS Y RENTAS-Exchange Student Guadalajara - Foráneos |
| — | 69k | Público | Habitaciones o cuartos en guadalajara jalisco |
| — | 67k | Público | Renta de Cuartos en Guadalajara y Zapopan |
| — | 67k | Privado | ROOMIES VIP GUADALAJARA - Renta cuartos Andares Chapu Providencia Chapalita |
| — | 67k | Público | Cuartos y Roomies ZMG (Gdl, Zapopan, Tlaquepaque) - Corto y Largo Plazo |
| — | 57k | Privado | BUSCO ROOMIE GDL, RENTA DE CUARTOS GDL, RENTA CASAS GDL, COMPARTO DEPA GDL, |
| — | 51k | Público | ROOMIES-ROOMMATES GUADALAJARA (Busca,ofrece,comparte depa o casa) |
| — | 39k | Público | Roomies Guadalajara 2026 Chapultepec -Centro -Americana |
| — | 32k | Público | Renta Cuartos y habitaciones en Guadalajara para jóvenes |
| — | 27k | Público | Roomies VIP Guadalajara |
| — | 24k | Privado | Roomies GDL |
| — | 21k | Privado | Roomies y cuartos en renta en Guadalajara |
| — | 19k | Público | Renta de cuartos/locales en Guadalajara (ZMG), Jalisco |
| — | 19k | Público | Guadalajara cuartos en renta |
| — | 18k | Público | Rentas GDL-ZAPOPAN- CUARTOS Y RENTAS- FORÁNEOS EXCHANGE STUDENT- GUADALAJAR |
| — | 17k | Público | Renta de cuartos Area Metropolitana de Guadalajara. |
| — | 13k | Público | Roomies Guadalajara |
| — | 12k | Público | RENTA DE CUARTOS LOFS GUADALAJARA JALISCO |
| — | 8.7k | Público | ROOMIES VIP GUADALAJARA - Renta cuartos Andares Chapu Providencia Chapalita |
| — | 8.2k | Público | Busco Cuarto o Roomie - GDL |
| — | 7.3k | Público | Renta de Cuartos Guadalajara - ROOMIES |
| — | 6.5k | Público | Roomies en Guadalajara Jalisco |
| — | 4.8k | Público | Roomies Renta de Cuartos en Guadalajara Con Precio Publico |
| — | 3.7k | Privado | Roomies Mujeres Gdl |
| — | 3k | Público | ROOMIES SÓLO HOMBRES ZAPOPAN/GUADALAJARA |
| — | 2.3k | Público | RoomiesGDL Habitaciones en Renta/Col Americana, Chapultepec & Centro Hist |
| — | 1.8k | Público | roomies gdl-alrededores |
| — | 1.5k | Público | Rentas para Estudiantes Guadalajara |
| — | 1.5k | Público | se renta cuarto guadalajara |
| — | 950 | Privado | ROOMS IN GUADALAJARA ZAPOPAN - STUDENT EXCHANGE ROOMS FOR RENT GUADALAJARA |
| — | 100 | Público | RENTAS BARATAS GUADALAJARA… roomis airbnb |

## Wave 2 — join queue (Tier A) — DONE 2026-08-01

All **21** Tier A gaps were joined or join-requested. Coverage for Tier A is complete for planning (private approvals may still be pending).

## Suggested sequencing (for next strategize session)

1. **Wave 1 outreach** — comment from personal account on landlord room posts across Tier A (prefer known high posts/day, then largest members where activity is unknown).
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
