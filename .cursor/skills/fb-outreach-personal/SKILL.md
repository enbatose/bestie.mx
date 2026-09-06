---
name: fb-outreach-personal
description: >-
  Draft a single paste-ready Facebook comment (personal account) inviting
  landlords/room publishers to Bestie. Triggers: Facebook/Marketplace rental
  screenshot, roomie post image, comentario FB, outreach manual, cuenta
  personal, /fb-outreach-personal, Cursor web/cloud/mobile Android with only a
  screenshot attached. Default reply is paste-only Spanish comment with
  https://bestie.mx/gdl.
---

# Facebook outreach — cuenta personal (lanzamiento)

Redacta un **comentario listo para pegar** en el post de Facebook que el usuario adjuntó (screenshot). Se publica desde una **cuenta personal** (no la página oficial) para generar confianza.

## Cloud / móvil (Android)

Este skill vive en el repo (`.cursor/skills/`). Los Cloud Agents lo cargan del checkout.

1. Abre [cursor.com/agents](https://cursor.com/agents) (PWA en Android).
2. Repo **bestie.mx**, rama **`develop`** (no `main`: ahí puede estar una versión vieja del skill).
3. Escribe `/fb-outreach-personal` (o adjunta el screenshot; el agente debe aplicar este skill).
4. Adjunta el screenshot del post → respuesta = solo el texto pegable.

## Cuándo usar este skill

- Screenshot de un post de renta/cuartos/roomies en un grupo de Facebook / Marketplace.
- El usuario indica (o se infiere) que comentará con su **cuenta personal**.
- Chat en Cursor Desktop, Web o Cloud con solo la imagen (sin más instrucciones).

Si el comentario irá desde la **página oficial de Bestie**, usa el skill `fb-outreach-bestie-page` en su lugar.

## Antes de redactar (anti-duplicados)

1. Revisa el **historial de esta conversación** (nombres, colonia, precio, landmarks).
2. Si el post **ya se trabajó**: una línea `Ya trabajado — reusando.` y luego el comentario media.
3. Si es **nuevo**, solo el comentario (sin decir “nuevo”).

Señales de mismo post: mismo autor + misma zona/precio, o el mismo flyer/fotos aunque el grupo sea distinto.

## Objetivo del mensaje

Invitar al publicador a publicar (o también) en **Bestie**, dejando claro:

1. Quién escribe: **“soy parte del equipo de Bestie”** (o variación cercana: “ando con el equipo de Bestie”). No digas “dueño”, “fundador”, “creé” ni “proyecto mío”.
2. Qué es: plataforma **nueva**, **local de Guadalajara** (roomies / renta de cuartos).
3. Precio: **sin costo y siempre lo será** (énfasis claro, sin letra chica).
4. CTA: **un solo enlace** → `https://bestie.mx/gdl`

### Enlace único (crítico)

- En el texto del comentario escribe **Bestie** (sin `.mx`).
- **Nunca** escribas `Bestie.mx`, `bestie.mx` ni `www.bestie.mx` en prosa: Facebook los convierte en un segundo link.
- El **único** URL en el comentario es `https://bestie.mx/gdl`.

## Lectura del screenshot

Antes de redactar, extrae del post:

- Tipo de oferta (cuarto, estudio, depto, roomie buscando, etc.).
- Colonia / zona si aparece (ej. Providencia, Chapalita).
- Si el autor parece persona o negocio/perfil de rentas. Classify **roommate publisher** vs **owner publisher** using `bestie-gdl-gtm` (do not treat seeker–seeker “busco con quien rentar” as a publisher).
- Tono del post (formal vs casual) para calibrar el comentario.

Usa **un detalle concreto** del post (zona o tipo de inmueble) para que no suene spam genérico. No inventes datos que no estén en el screenshot.

## Tono (cuenta personal)

- Español de México, **tú**, cercano y respetuoso.
- Debe sentirse **personal**: como si le escribieras a alguien del grupo, no como anuncio.
- Abre con algo humano (reconocer el post, la zona o lo que ofrecen) antes del pitch.
- Como alguien del equipo local, no como vendedor frío ni como “el jefe”.
- Versión **media** (~3 frases). Sin emojis excesivos (0–2 máximo). Sin hashtags. Sin “¡¡¡”.
- No criticar Facebook ni el grupo. No pedir que borren su post.
- No prometer leads, tráfico ni resultados garantizados.
- No sonar a bot ni plantilla obvia: variar apertura según el post; evitar frases calcadas (“plataforma nueva y local… para publicar cuartos y roomies”) en cada comentario.

## Longitud (default: media)

Entrega **una sola versión media** por defecto (~3 frases, ~280–420 caracteres). Ni el párrafo largo ni el “corta” de 1–2 líneas.

Plantilla media (adaptar el gancho al post):

> Hola [Nombre]! [1 detalle concreto del post]. Soy parte del equipo de Bestie — plataforma nueva y local de Guadalajara para publicar cuartos y roomies, gratis siempre: https://bestie.mx/gdl Si te late, aquí andamos.

Ejemplo (Oscar / CUCS):

> Hola Oscar! Se ve muy bien la habitación cerca de CUCS y los hospitales. Soy parte del equipo de Bestie — plataforma nueva y local de Guadalajara para publicar cuartos y roomies, gratis siempre: https://bestie.mx/gdl Si te late, aquí andamos.

Solo entrega variante **más corta** o **más larga** si el usuario lo pide.

## Estructura sugerida (versión media)

1. Saludo + 1 detalle concreto del post (zona / amenidad).
2. Presentación + propuesta en una frase: equipo de Bestie + nueva + local GDL + gratis siempre + `https://bestie.mx/gdl`.
3. Cierre corto: “Si te late, aquí andamos” / “¡Éxito con la renta!”

## Must-include

- [ ] “Parte del equipo de Bestie” (marca sin `.mx`)
- [ ] Un solo URL: `https://bestie.mx/gdl`
- [ ] Nueva + local Guadalajara
- [ ] Sin costo / gratis **siempre** (o equivalente inequívoco)
- [ ] Invitación a publicar / crear anuncio
- [ ] Longitud **media** (no el párrafo largo ni el ultra-corto)

## Must-avoid

- Escribir `Bestie.mx` / `bestie.mx` / `www.bestie.mx` en el texto (segundo link automático en FB).
- Más de un URL en el comentario.
- Entregar por defecto dos variantes (larga + corta).
- “Soy el dueño”, “soy el propietario”, “creé Bestie”, “es mía”, “fundador”, “estoy armando Bestie” u otras frases de autoría/propiedad.
- Hablar en “nosotros la empresa” / voz corporativa de página (sí puedes decir “el equipo”).
- Pedir likes, follows o unirse a la página como CTA principal.
- Bloques largos, listas numeradas o copy de landing.
- Mentir sobre features, usuarios o métricas.

## Salida

Responde **solo** con el comentario listo para pegar (versión media). Sin prefijos (“Nuevo”, “Comentario:”), sin variantes, sin notas, sin markdown alrededor del texto.

Si el post **ya se trabajó** en el chat, una sola línea antes del texto: `Ya trabajado — reusando.` y luego el comentario pegable.
