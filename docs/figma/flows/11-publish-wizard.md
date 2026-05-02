# 11 — Publish wizard

## Figma frames (one per wizard step title)

Use the **exact step titles** as frame names so devs match `PublishWizardPage` without ambiguity.

### Room mode (`postMode === "room"`)

| Step # | Frame name |
| --- | --- |
| 1 | `Publicar · 1 · ¿Qué quieres publicar?` |
| 2 | `Publicar · 2 · Ubicación` |
| 3 | `Publicar · 3 · Propiedad` |
| 4 | `Publicar · 4 · Cuartos` |
| 5 | `Publicar · 5 · Fotos` |
| 6 | `Publicar · 6 · Publicar` |

### Property mode (`postMode === "property"`)

Same as above **plus** insert after Fotos:

| Step | Frame name |
| --- | --- |
| Extra | `Publicar · N · Etiquetar fotos` |

(`N` = step index in UI: “Paso X de Y” — Y is longer in property mode.)

## Route

- `/publicar` — create
- `/publicar?edit=:propertyId` — edit existing

## Implementation

`src/pages/PublishWizardPage.tsx`  
Map: `WizardLocationMap`, `BulkImageUploader`, stepper footer (“Paso X de Y”, Atrás, Continuar / Publicar).

## User goals

- Choose **single room** vs **multi-room property**.
- Set city, map pin, privacy (approximate location).
- Enter property fields (property mode), room details, photos.
- Property mode: assign uncategorized photos to rooms / shared / facade.
- Legally confirm and publish or save draft (final step).

## Per-step UI blocks (Figma sections → components)

### 1 — ¿Qué quieres publicar?

- Two **large selectable cards**: “Un cuarto o Loft” vs “Propiedad con múltiples cuartos”
- Helper text under section title “Modalidad de anuncio”

### 2 — Ubicación

- Card **Ciudad Principal** — `select` of cities
- Card **Dirección en Mapa** — map + draggable pin, helper copy
- Checkbox **Ocultar dirección exacta** (approximate location)
- Card **Ajuste Seguro** — `details` / disclosure: manual lat/lng inputs

### 3 — Propiedad

- **Datos generales**: property name, neighborhood, description textarea + char counter
- **Características físicas**: housing type select, bedrooms total, bathrooms (0.5 step)
- **Contacto**: WhatsApp input, checkbox “Mostrar WhatsApp en el anuncio público”

### 4 — Cuartos

- Repeatable **room panel** (Cuarto 1…n): remove when `n > 1`
- Subsections: Información principal, Disponibilidad, Perfil buscado, Detalles + tag chips
- Dashed button: add room (disabled copy in room-only mode)

### 5 — Fotos

- Property mode: **unassigned** bulk uploader block
- Per room: **Galería: Cuarto n** + `BulkImageUploader`

### Etiquetar fotos (property only)

- Summary counts: sin categorizar / propiedad / cuartos
- List of uncategorized thumbnails + **Asignar a…** select (shared, facade, room N)
- Quick action: “Etiquetar todo como Áreas compartidas”

### 6 — Publicar

- **Revisión final** copy
- Legal confirmation + publish / save draft controls (match live form; includes server sync messaging)

## Flows out

- **Anonymous**: autosave + redirect to `/entrar` when required (guard paths in wizard).
- **Success publish** → `/anuncio/:roomId` (or draft path to `/mis-anuncios` per implementation).
- **Mis anuncios** — draft management entry point.

## Wizard chrome (shared frame layer)

- Step indicator: “Paso {safeStep+1} de {steps.length}”
- Buttons: Atrás, Continuar (hidden on publish step when publish UI takes over)
