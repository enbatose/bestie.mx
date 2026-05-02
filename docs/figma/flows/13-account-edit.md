# 13 — Account edit

## Figma frames

- `Perfil editar · loading`
- `Perfil editar · logged out`
- `Perfil editar · profile form`
- `Perfil editar · change password` (section)
- `Perfil editar · success / error` (inline messages)

## Route

`/perfil/editar`

## Implementation

`src/pages/AccountEditPage.tsx`

## User goals

- Update display name and email.
- Change password (current + new + confirm).
- Understand when current password is required (email change rules; WhatsApp-only account variant `isWaOnly`).

## Layout zones

| Zone | Contents |
| --- | --- |
| Profile | displayName, email, conditional current password |
| Password | optional separate form block |

## Components

- `Form/ProfileUpdate`
- `Form/ChangePassword`
- `Input/Password` (masked fields)
- `Message/InlineSuccess`, `Message/InlineError`

## Flows out

- **Perfil** — back link as implemented
- **Entrar** — logged-out gate
