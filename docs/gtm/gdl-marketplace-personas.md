# Bestie GDL — personas, POIs, and seeker growth

**Canonical GTM memory for Guadalajara.** Lives in the repo so every agent, chat, Cloud Agent, and human teammate uses the same model. Cursor also loads a short always-on rule that points here: `.cursor/rules/bestie-gdl-gtm.mdc`.

Brand voice still follows `docs/PRODUCT_V1.md` and `.cursor/rules/bestie-brand.mdc` (es-MX, **tú**, roomie/bestie, not luxury PropTech). Paste-ready Facebook **group comments**: `.cursor/skills/fb-outreach-personal` / `fb-outreach-bestie-page`. Motion ads: `.cursor/skills/fb-motion-gif` (separate creatives per **role**).

Facebook group inventory (demand proxy): [facebook-groups-gdl-roomies.md](./facebook-groups-gdl-roomies.md).

Recheck live stock with `GET https://www.bestie.mx/api/listings` before any number in an ad. Campus/office snapshot **Prod · 5 Sep 2026**; **Zona Chapultepec/Americana** union recounted **Prod · 6 Sep 2026** (63 published rooms). “Cerca” = haversine **3.5 km** unless noted.

---

## How the marketplace is supposed to work

Bestie is two-sided. Cold start was **supply first** (~50+ GDL rooms, most of them partner-created from the main Facebook roomie group, not organic self-serve). The current job is **close the loop with seekers** on POIs that already have stock, so publishers *feel* demand and start posting on their own.

| Loop | Who | What success looks like |
| --- | --- | --- |
| 1. Demand (now) | Seekers | Click → map matches the headline → WhatsApp or in-app message |
| 2. Roommate supply | Roommate publishers | One good match, then they leave for months |
| 3. Owner supply | Owner publishers | A room fills → they come back next vacancy |

Endorsement is **their own Bestie experience**, not a pretty ad. Seeker ads also get seen by some publishers in the GDL feed (secondary). Do not stop a light publisher trickle, especially for empty prestige pins (Tec, Andares).

**Conversion proxy for the ~95% unclaimed / FB-imported posts:** `listing_contact_clicked` / “ver teléfono”. There is no WhatsApp/call attribution yet. When a partner listing gets several reveals, **tell that original poster** (“esta semana X personas pidieron tu número en Bestie”). Waiting for call tracking before doing that stalls the loop.

Identity verification, owner dashboards, and “success metrics” ads are **later**. Quiet view/message counts already exist in Mis Anuncios. New verification is a legal-docs trigger — do not invent it in this phase.

---

## Three seeker personas

Always pick **one persona + one POI** per ad. Voice changes; geography stays specific.

### 1. Estudiante (students)

- **Who:** ~18–26, including foráneos and some médicos residentes near CUCS.
- **Job:** A cuarto near *this* campus, often furnished, services included, semester timing.
- **Geo rule:** One campus (or a real pair that sits together: **ITESO + UVM**, **Tec + UP**). Never “UDG” as one place — name **CUCS / CUCEI / CUCEA / CUAAD**.
- **Do not advertise yet without stock:** Tec GDL, UAG.
- **Season:** Jul–Ago and January matter more than the rest of the year.
- **Voice:** Peer, practical, campus-native. Distance and price first. Not childish, not “residencia estudiantil corporativa.”
- **Words that work:** cuarto, roomie, cerca del ITESO / CUCS, amueblado, servicios incluidos, 15 min.
- **Avoid:** Stacking ITESO + Tec + UDG + UAG. Luxury tone. “Universidad de Guadalajara” with no campus.
- **Use:** `8 cuartos cerca del ITESO y UVM. Mapa, fotos y WhatsApp en Bestie.`
- **Not:** `Cuartos cerca de ITESO, Tec, UDG y UAG`

### 2. Profesionista (two collars — still one persona)

Not a fourth seeker. Split **voice and corridor** only. Still **one collar + one POI** per ad. Do not mix Centro copy with Midtown/Andares copy.

Shared job: sleep near work. Time > nightlife. Still-tú. No LinkedIn-English. No fiesta.

**Commute mode (does change the line):** cuello blanco mostly **drives** — sell skipping **tráfico**, not the SITEUR map. Cuello azul mostly **rides transit** — sell **camión / Línea 3 / parada**, not the parking lot. Some cuello azul also use **moto** more than a car; that is real but **do not** make moto a voice or identity hook (no “para tu moto,” no biker tone). Moto parking is a listing fact when it exists, not ad personality.

#### 2a. Cuello blanco (Godínez / oficina)

- **Who:** ~24–40, salaried office / corporativo / cubículo. Zapopan poniente and corredor Américas.
- **Pins:** **Punto Sao Paulo / Midtown**, **Galerías**, **Andares** (when stock exists). **Country Club** is in this blob geographically — **do not name it** in ads (colonia, not a search term; same Américas corridor as Midtown).
- **Do not advertise yet without stock:** Andares / Zona Real / Puerta de Hierro.
- **Subculture to tap:** Mexican **Godínez / godín / godinear** — the oficinista with jefe, horario ~9 a 6, quincena, cubículo, tupper, gafete, and the clock-out dash. It is a **labor identity**, not “naco,” not lazy, not a class slur. In CDMX, MTY, and GDL corporates, people use it on themselves with resigned humor. Ads should wink **with** that in-group, like a coworker who gets the commute — never punch down, never call the reader Godínez as an insult, never use it on Centro/cuello-azul ads (they are not that joke).
- **Voice:** Composed still-tú + a light Godínez wink. Dignity of getting home on time. The pain is **tráfico** and crossing the city in a car, not missing a camión. Commute and calm, not glamour towers-as-lifestyle (that is Lifestyler / Andares-as-prestige).
- **Words that work:** cerca de Punto Sao Paulo, Midtown, Andares (when stock), sin cruzar la ciudad, sin comerte el tráfico, zona de oficinas, cubículo, hora de salida, quincena, llega al trabajo.
- **Avoid:** “Centro Financiero.” Naming Country Club. Laundry list of malls. Nightlife copy. Mocking the tupper/gafete. HR-brochure Spanish. Leading with Línea 3 / camión / parada as the hook (that is cuello azul).
- **Use:** `12 cuartos cerca de Punto Sao Paulo y Midtown. Llega a tu cubículo sin comerte el tráfico.`
- **Use:** `Cerca del trabajo, no de la disco. Sales a tu hora y ya estás en tu cuarto.`
- **Not:** `Cerca de Andares, Centro Financiero, Galerías, Country Club y Centro`

#### 2b. Cuello azul (Centro / práctico)

- **Who:** ~24–40, jobs in and around the Centro: oficios, servicios, comercio, talleres, piso de tienda, operación — **not** the Midtown cubicle. Also first-job / transit-heavy profesionistas who need the rent and the pasaje to add up.
- **Pin:** **Centro**. Same geography can still run **Estudiante** ads (CUCS overlap, foráneos). Those are a different persona, not this voice.
- **Job:** A cuarto that is cheap to reach and cheap to keep. Practicality over image. The commute that matters is **public transport** (Línea 3, camión, parada, fewer transbordos) — not car traffic.
- **Voice:** Direct, cost-efficient, zero glamour. Camión, Línea 3, renta que rinde. No Godínez memes, no “zona de oficinas,” no Midtown aspiration, no “evita el tráfico” car copy.
- **Words that work:** Centro, Línea 3, camión, parada, a pie, transbordo, renta, pasaje, práctico, te rinde.
- **Avoid:** Cubículo / godín / gafete. Treating Centro as white-collar office. Luxury or “revitalización del Centro” tourism copy. Tráfico / auto / estacionamiento as the hero. Moto-as-lifestyle (“traes moto,” “para tu moto”) — even if many ride one, it does not change this voice.
- **Use:** `23 cuartos en el Centro. Llegas en camión o Línea 3 y te rinde más la renta.`
- **Not:** `Cuartos en el Centro Financiero, cerca de tu oficina en Midtown`

### 3. Lifestyler

- **Who:** ~22–35, colonia identity, cafés, bars, walkability. May already live in the belt and want a calmer or livelier block.
- **Job:** Live *in* a named zona, not next to a campus or tower.
- **Geo rule:** More flexible **inside** the west-central lifestyle belt (**Zona Chapultepec/Americana** + Zona Minerva + Chapalita + Providencia). Still **one landmark per creative**. Zona Chapultepec/Americana → Providencia/Chapalita as a calmer move is valid. Americana → Andares is a different product — Andares is office/prestige, not this belt.
- **Voice:** Local, warm, tapatío. Place names as identity. Not luxury real estate, not “coolest neighborhood in the world” travel-blog.
- **Words that work:** Zona Chapultepec/Americana, Americana, Chapultepec, Moderna, Lafayette, Chapalita, Providencia, Zona Minerva, la glorieta.
- **Avoid:** Listing Americana + Chapultepec + Moderna + Lafayette as four separate ad pins (they are **one** zona). Calling Andares a lifestyle pin.
- **Use:** `26 cuartos en Zona Chapultepec/Americana. Cafés, bares y Línea 3 a unos pasos.`
- **Use:** `Cuartos en Zona Minerva. Vallarta, Justo Sierra y la glorieta a unos pasos.`
- **Not:** `Cerca de Chapalita, Providencia, Andares y Americana`

### Cross-cut (not a fourth persona, not a pin)

**Foráneos / intercambio** — huge Facebook demand. Map them onto campus + Americana/Centro ads and seasonal timing. Do not invent a “foráneos POI.”

---

## Two publisher personas

### Owner publishers

People who do this as a **business**: at least one property with 2+ rooms, or several properties. Product shape: **property-mode** / nested recámaras.

- Recurrence: roughly **every couple of months** if several rooms turn over (e.g. 4 rooms × ~12-month stay ≈ a vacancy every few months). Casas de asistencia faster.
- They are the **organic supply engine**. They compare Bestie vs the Facebook group as a channel.
- Later (not now): proof (“X personas pidieron teléfono en Americana”) and owner tools.
- Outreach/ads later: inventory language, not roommate-romance. *Esta semana X personas pidieron teléfono en [POI].*

### Roommate publishers

People filling **the empty room where they already live** (or posting the one recámara they need covered). Product shape: **room-mode** / single cuarto.

- Recurrence: planning average **8–12 months**. Unlucky/student tail 2–6 months; professionals often 12–24. They need a good experience, not a CRM.
- High trust, **low catalog refill**. They tell friends, then disappear. They also become seekers again later.
- Do not sell them “gestiona tu portafolio.” Later copy: *Tu roomie te escribió por Bestie.*

---

## Third behavior — seeker–seeker (not a publisher)

People who want to **meet others and rent a place together** (no room listed yet).

This is matching, not inventory. Do **not** mix it into publisher growth, Mis Anuncios, or “X cuartos cerca de…” ads. Product v1 already calls this out as **groups** of compatible people organizing to rent together (`docs/PRODUCT_V1.md`). If it appears in UX, it is saved searches, grupos/comunidades, or seeker profiles — not a listing count.

---

## Targeting rules (non-negotiable)

1. **One destination per ad.** Headline POI must match the map bbox the click opens (prefer `/gdl` with a zone, not a generic city dump).
2. **Only advertise pins with enough live rooms.** Empty prestige keywords (Tec, Andares) train Meta and seekers that Bestie is empty.
3. **“Cerca” ≈ 3.5 km / ~15 min** in ZMG traffic. Do not use 5 km+ for a “cerca de” claim. Counts overlap across nearby pins — do not add them.
4. **Live counts.** Recheck Prod catalog before shipping a number. Unique rooms, not a slogan.
5. **Persona voice ≠ broader geography.** Students stay tight. Profesionistas stay tight **and** keep cuello blanco vs cuello azul on separate ads. Lifestylers may share a campaign and retargeting pool across the belt, still one pin per post.
6. **Separate seeker vs publisher creatives** (same as `fb-motion-gif`).

---

## Naming — Chapultepec and Minerva

**Zona Chapultepec/Americana** is the practical lifestyle **ad pin**. It clubs **Americana**, **Chapultepec**, **La Moderna**, and **Lafayette**. One persona + this one pin per creative — do not buy four budgets or stack those four names in a headline.

Each listing still keeps its own colonia on the post (search chips, card, map). The zona name is for ads and targeting, not a wipe of neighborhood context.

| Scope | Colonias | Ad use |
| --- | --- | --- |
| **Zona Chapultepec/Americana** | **Americana**, **Chapultepec**, **Moderna**, **Lafayette** | One lifestyle pin. Headline: *Zona Chapultepec/Americana*. Nightlife searchers still say Chapultepec; listing cards still say the colonia. Union stock **26 rooms / 23 properties** within 3.5 km of any of the four pins (Prod · 6 Sep 2026). |
| Outer ring (not in the club) | **Ladrón de Guevara**, **Santa Tere** | OK in body as “zona Chapultepec.” Santa Tere has its own identity and overlaps Centro — do **not** count those rooms in Zona Chapultepec/Americana stock. |

**Zona Minerva** is a **separate** lifestyle POI (not inside Zona Chapultepec/Americana): La Minerva roundabout, **Justo Sierra**, **Vallarta Norte**, west edge of Ladrón de Guevara. Hinge between Americana, Chapalita, and Providencia. Bestie’s default GDL map pin is already the fountain. Thinner stock — named creative, not a volume laundry list.

---

## Campus pins (estudiantes)

| Pin | Pair with | Demand | Stock 3.5 km | Ads now? |
| --- | --- | ---: | ---: | --- |
| ITESO | **UVM** (sur) | Very high | 8 | Yes |
| CUCS | Hospitales / Centro Médico / Civiles | High | 17 | Yes — strongest student claim |
| CUCEI | — | High | 13 | Yes |
| CUAAD | Huentitán | Medium | 8 | Optional |
| CUCEA / CUCSH | Belenes, Zapopan | Medium | 5 | Optional |
| UAG | West Zapopan / Andares blob | Medium | 4 | No — wait for stock |
| Tec GDL | **UP** | Very high | 2 | No |

Never headline **UDG** without the campus. ITESO and Tec are opposite sides of the metro.

---

## Job-corridor pins (profesionistas)

Collar is the voice. Pin is still one destination.

| Pin | Collar | How locals say it | Stock 3.5 km | Ads now? |
| --- | --- | --- | ---: | --- |
| Punto Sao Paulo / Midtown / Av. Américas | **Cuello blanco** | Midtown, Punto Sao Paulo, Américas | 12 | Yes — lead Godínez / office |
| Andares / Zona Real / Puerta de Hierro | **Cuello blanco** | Andares | 5 | No — prestige, thin stock |
| Galerías | **Cuello blanco** | Galerías, Vallarta | 5 | Secondary test only |
| Country Club | **Cuello blanco** | — | 11 | **Do not name.** Same Américas blob as Midtown |
| Centro | **Cuello azul** | Centro | 23 | Yes — practical profesionista (also student/transit ads, different persona) |

Do not say **Centro Financiero**. Do not run Godínez copy on Centro.

---

## Lifestyle pins

| Pin | Scope | Stock | Ads now? |
| --- | --- | --- | --- |
| **Zona Chapultepec/Americana** | Americana + Chapultepec + Moderna + Lafayette (union, not a sum) | **26** rooms / 23 properties · 3.5 km | Yes — lead lifestyle |
| Chapalita | Own creative; calmer move from the zona | 10 | Yes |
| Providencia | Lifestyle *and* office overlap — fine | 13 | Yes (either campaign, not both Andares-style) |
| Zona Minerva | Justo Sierra, Vallarta Norte, glorieta | 8 / 3.5 km | Yes as a named pin, not a volume claim |
| Andares | — | 5 | **Office only**, when stock exists |

---

## Suggested seeker ad sets (when stock holds)

| Ad set | Persona | Honest line pattern |
| --- | --- | --- |
| ITESO + UVM | Estudiante | *8 cuartos a menos de 15 min del ITESO* |
| CUCS / hospitales | Estudiante | *17 cuartos cerca de CUCS y el Centro Médico* |
| CUCEI | Estudiante | *13 cuartos cerca de CUCEI* |
| Zona Chapultepec/Americana | Lifestyler | *26 cuartos en Zona Chapultepec/Americana* |
| Chapalita | Lifestyler | *10 cuartos en Chapalita* |
| Zona Minerva | Lifestyler | *Cuartos en Zona Minerva, a unos pasos de la glorieta* |
| Midtown / Punto Sao Paulo | Profesionista cuello blanco | *12 cuartos cerca de Punto Sao Paulo y Midtown. Sin comerte el tráfico* |
| Centro | Profesionista cuello azul (or Estudiante, separate ads) | *23 cuartos en el Centro. Llegas en camión o Línea 3* |

Park: Tec + UP; Andares / Zona Real / UAG.

---

## Measurement (this phase)

| Signal | Use for |
| --- | --- |
| In-app messages | Claimed Bestie users (truth) |
| Phone reveal / `listing_contact_clicked` | Partner-created posts (proxy) |
| Listing views in Mis Anuncios | Quiet owner metadata — not a public dashboard |

Manual close: ping the original Facebook publisher when reveals cluster on their room.

---

## What not to do

- One line: “cuartos cerca de ITESO, Tec, UDG y UAG.”
- One line: “Andares, Centro Financiero, Galerías, Country Club y Centro.”
- Treat Centro as a white-collar / Godínez office pin.
- Use Godínez as a punch-down, or on cuello-azul Centro ads.
- Sell Midtown/Andares on camión / Línea 3, or Centro on “evita el tráfico” in a car.
- Make moto a personality hook in cuello-azul ads.
- Treat seeker–seeker as publishers.
- Pause all publisher outreach the week seeker ads go live.
- Promise leads to publishers.
- Build ID verification or WhatsApp attribution before the loop produces replies.
