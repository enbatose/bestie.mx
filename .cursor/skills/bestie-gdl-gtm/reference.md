# Bestie GDL GTM — POI atlas and copy

Recheck live stock with `GET https://www.bestie.mx/api/listings` before any number in an ad. Snapshot below is **Prod · 5 Sep 2026** (63 published rooms). “Cerca” = haversine **3.5 km** unless noted.

Facebook demand proxies: `docs/gtm/facebook-groups-gdl-roomies.md` (search `roomies gdl`, 1 Aug 2026).

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

| Pin | How locals say it | Stock 3.5 km | Ads now? |
| --- | --- | ---: | --- |
| Punto Sao Paulo / Midtown / Av. Américas | Midtown, Punto Sao Paulo, Américas | 12 | Yes — lead office |
| Andares / Zona Real / Puerta de Hierro | Andares | 5 | No — prestige, thin stock |
| Galerías | Galerías, Vallarta | 5 | Secondary test only |
| Centro | Centro | 23 | Not as office. Use as budget/student/transit |
| Country Club | — | 11 | **Do not name.** Same Américas blob as Midtown |

Do not say **Centro Financiero**.

---

## Lifestyle pins

| Pin | Scope | Stock | Ads now? |
| --- | --- | --- | --- |
| Americana / Chapultepec | Core + Lafayette + Moderna in the same bbox | 19 rooms / 3.5 km Americana; 12 rooms / 2 km core union | Yes — lead lifestyle |
| Chapalita | Own creative; calmer move from Americana | 11 | Yes |
| Providencia | Lifestyle *and* office overlap — fine | 13 | Yes (either campaign, not both Andares-style) |
| Zona Minerva | Justo Sierra, Vallarta Norte, glorieta | 5 / 2 km · 8–12 / 3.5 km | Yes as a named pin, not a volume claim |
| Andares | — | 5 | **Office only**, when stock exists |

Chapultepec nested names (official vs speech): see parent `SKILL.md`.

---

## Suggested seeker ad sets (when stock holds)

| Ad set | Persona | Honest line pattern |
| --- | --- | --- |
| ITESO + UVM | Estudiante | *8 cuartos a menos de 15 min del ITESO* |
| CUCS / hospitales | Estudiante | *17 cuartos cerca de CUCS y el Centro Médico* |
| CUCEI | Estudiante | *13 cuartos cerca de CUCEI* |
| Americana / Chapultepec | Lifestyler | *19 cuartos en Americana y Chapultepec* |
| Chapalita | Lifestyler | *11 cuartos en Chapalita* |
| Zona Minerva | Lifestyler | *Cuartos en Zona Minerva, a unos pasos de la glorieta* |
| Midtown / Punto Sao Paulo | Profesionista | *12 cuartos cerca de Punto Sao Paulo y Midtown* |
| Centro | Budget / student / first job | *23 cuartos en el Centro de Guadalajara* |

Park: Tec + UP; Andares / Zona Real / UAG.

---

## Voice examples (es-MX, tú)

**Estudiante — use / not**

- Use: `8 cuartos cerca del ITESO y UVM. Mapa, fotos y WhatsApp en Bestie.`
- Not: `Cuartos cerca de ITESO, Tec, UDG y UAG`

**Profesionista — use / not**

- Use: `12 cuartos cerca de Punto Sao Paulo y Midtown. Llega al trabajo sin cruzar la ciudad.`
- Not: `Cerca de Andares, Centro Financiero, Galerías, Country Club y Centro`

**Lifestyler — use / not**

- Use: `19 cuartos en Americana y Chapultepec. Cafés, bares y Línea 3 a unos pasos.`
- Use: `Cuartos en Zona Minerva. Vallarta, Justo Sierra y la glorieta a unos pasos.`
- Not: `Cerca de Chapalita, Providencia, Andares y Americana`

UI/product strings still follow `bestie-brand`: no emoji spam, prefer no exclamation marks, **anuncio / cuarto / recámara / roomie**.

---

## Publisher copy (later, after reveals exist)

- Roommate publisher: one filled room, human, not portfolio. *Tu roomie te escribió por Bestie.*
- Owner publisher: channel proof. *Esta semana X personas pidieron teléfono en [POI].*

Do not promise leads. Do not use seeker nightlife copy on owner ads.

---

## Measurement (this phase)

| Signal | Use for |
| --- | --- |
| In-app messages | Claimed Bestie users (truth) |
| Phone reveal / `listing_contact_clicked` | Partner-created posts (proxy) |
| Listing views in Mis Anuncios | Quiet owner metadata — not a public dashboard |

Manual close: ping the original Facebook publisher when reveals cluster on their room.
