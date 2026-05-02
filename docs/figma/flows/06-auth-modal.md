# 06 — Auth modal (email)

## Figma frames

- `AuthModal · login`
- `AuthModal · register`
- `AuthModal · error inline`
- `AuthModal · busy` (disabled submit)

## Route / scope

Global overlay — not a route. `src/components/AuthModal.tsx` via `AuthModalProvider` in `AppShellLayout`.

## User goals

- Log in or register with **email + password** without leaving the current page.
- After success, land on publisher hub (`window.location.assign("/mis-anuncios")`).

## Layout zones

| Zone | Contents |
| --- | --- |
| Scrim | Full viewport dim + click-outside to close |
| Card | Title, close button, tab switch (handled as single `tab` prop: login vs register) |
| Form | Fields + primary submit |

## Components

- `Modal/AuthScrim`
- `Modal/AuthCard`
- `Form/EmailLogin` (email, password, submit)
- `Form/EmailRegister` (display name optional, email, password, confirm with paste blocked on confirm)
- `Input/Password` (reuse with `PasswordField` behavior in dev notes)

## Flows out

- **Mis anuncios** — hard navigation on success (`/mis-anuncios`).
- **Close** — return to underlying screen unchanged.

## Relationship to full pages

WhatsApp OTP lives on `/entrar`, not this modal. See [07-sign-in](./07-sign-in.md).
