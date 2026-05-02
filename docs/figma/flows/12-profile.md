# 12 — Profile (account summary)

## Figma frames

- `Perfil · loading`
- `Perfil · logged out` (CTA Entrar)
- `Perfil · logged in · complete`
- `Perfil · logged in · phone missing` (amber “Completa tu perfil” callout)

## Route

`/perfil`

## Implementation

`src/pages/ProfilePage.tsx`

## User goals

- See email / WhatsApp verification state and linked publishers.
- Know when phone is missing and why it matters.

## Layout zones

| Zone | Contents |
| --- | --- |
| Greeting | Display name |
| Definition list | Correo, verificación, WhatsApp, publicadores vinculados |
| Callout | Incomplete profile guidance + link to edit |

## Components

- `Profile/StatRow`
- `Callout/CompleteProfile`
- `Button/Primary` → link to `/perfil/editar` or `/entrar`

## Flows out

- **Editar cuenta** — `/perfil/editar`
- **Entrar** — when logged out
