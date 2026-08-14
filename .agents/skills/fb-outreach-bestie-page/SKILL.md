---
name: fb-outreach-bestie-page
description: >-
  Draft a single paste-ready Facebook comment from the official Bestie Page
  inviting landlords/room publishers to Bestie. Triggers: Facebook rental
  screenshot for página oficial, cuenta empresa, Page Bestie, brand account,
  /fb-outreach-bestie-page, Cursor web/cloud/mobile. Paste-only Spanish with
  https://bestie.mx/gdl (not personal-account voice).
---

# Facebook outreach — página oficial Bestie

Redacta un **comentario listo para pegar** en el post de Facebook que el usuario adjuntó (screenshot). Se publica desde la **página oficial de Bestie** (voz de marca / empresa).

## Cloud / móvil (Android)

1. [cursor.com/agents](https://cursor.com/agents) → repo **bestie.mx** → rama **`develop`**.
2. `/fb-outreach-bestie-page` + screenshot del post.
3. Respuesta = solo el texto pegable.

## Cuándo usar este skill

- Screenshot de un post de renta/cuartos/roomies en un grupo de Facebook.
- El usuario indica que publicará como **Bestie** (página / empresa), no con su perfil personal.
- Outreach donde la identidad de marca ya es aceptable (voz de Página, no “parte del equipo” desde perfil personal).

Si el comentario irá desde una **cuenta personal** (lanzamiento / confianza), usa el skill `fb-outreach-personal` en su lugar.

## Objetivo del mensaje

Invitar al publicador a publicar en **Bestie**, dejando claro:

1. Quién escribe: **Bestie** (plataforma), no un perfil anónimo.
2. Qué es: marketplace de roomies / cuartos, **local en Guadalajara**, plataforma reciente.
3. Precio: **sin costo y siempre lo será**.
4. CTA: **un solo enlace** → `https://bestie.mx/gdl`

### Enlace único (crítico)

- En el texto del comentario escribe **Bestie** (sin `.mx`).
- **Nunca** escribas `Bestie.mx`, `bestie.mx` ni `www.bestie.mx` en prosa: Facebook los convierte en un segundo link.
- El **único** URL en el comentario es `https://bestie.mx/gdl`.

## Lectura del screenshot

Antes de redactar, extrae del post:

- Tipo de oferta (cuarto, estudio, depto, roomie buscando, etc.).
- Colonia / zona si aparece.
- Si el autor parece persona o negocio de rentas.
- Tono del post para calibrar formalidad.

Usa **un detalle concreto** del post. No inventes datos ausentes en el screenshot.

## Tono (página oficial)

- Español de México, **tú**, amable y profesional — marca cercana, no corporativo frío.
- Habla como **Bestie** (“en Bestie…”, “te invitamos…”, “puedes publicar…”).
- **No** digas “soy parte del equipo” ni firmes con nombre personal (eso es cuenta personal).
- Corto: ~2–5 oraciones + enlace.
- 0–2 emojis máximo. Sin hashtags. Sin spam de “síguenos”.
- No criticar Facebook ni el grupo. No pedir que quiten su post.
- No prometer leads ni resultados garantizados.
- Variar la apertura según el post; evitar plantilla idéntica en cada comentario.

## Longitud (default: media)

Entrega **una sola versión media** por defecto (~3 frases). Ni párrafo largo ni ultra-corto.

Plantilla media (adaptar el gancho):

> Hola! [1 detalle del post]. En Bestie — plataforma nueva y local de Guadalajara — puedes publicar cuartos y roomies gratis siempre: https://bestie.mx/gdl Si te sirve, aquí estamos.

Solo entrega variante más corta o más larga si el usuario lo pide.

## Estructura sugerida (versión media)

1. Saludo + referencia concreta al anuncio.
2. Bestie + local GDL + gratis siempre + `https://bestie.mx/gdl` (una frase).
3. Cierre corto.

## Must-include

- [ ] Identidad de marca **Bestie** (sin `.mx` en prosa; no “parte del equipo” en primera persona)
- [ ] Un solo URL: `https://bestie.mx/gdl`
- [ ] Local Guadalajara (+ “nueva” o “recién lanzada” si encaja natural)
- [ ] Sin costo / gratis **siempre**
- [ ] Invitación clara a publicar / crear anuncio
- [ ] Longitud **media**

## Must-avoid

- Escribir `Bestie.mx` / `bestie.mx` / `www.bestie.mx` en el texto (segundo link automático en FB).
- Más de un URL en el comentario.
- Entregar por defecto dos variantes (larga + corta).
- Voz de “soy parte del equipo” / nombre personal (reservado a cuenta personal).
- CTA principal = like / follow de la Page (el CTA es publicar en el sitio).
- Copy largo de marketing, bullets o tono de anuncio pagado.
- Inventar métricas, partners o cobertura fuera de GDL si el post es local.

## Salida

Responde **solo** con el comentario listo para pegar (versión media). Sin prefijos, sin variantes, sin notas, sin markdown alrededor del texto.

Si el post **ya se trabajó**, una sola línea antes: `Ya trabajado — reusando.` y luego el comentario.
