# 08 — Register (full page, email)

## Figma frames

- `Registro · form default`
- `Registro · validation error`
- `Registro · success` (optional: navigates away quickly)

## Route

`/registro`

## Implementation

`src/pages/RegisterPage.tsx`  
Uses `PasswordField` with anti-paste on confirm.

## User goals

- Create email account with display name, password, confirmed password.
- Land on `/mis-anuncios` when registered.

## Layout zones

| Zone | Contents |
| --- | --- |
| Intro | H1 “Crear cuenta”, policy copy |
| Form | Display name, email, password, confirm password |
| Submit | Primary button |

## Components

- Same primitives as [06-auth-modal](./06-auth-modal.md) but full-page width (`max-w-md` pattern).

## Flows out

- **Mis anuncios** — `navigate("/mis-anuncios", { replace: true })` on success.
- **Entrar** — `Link` at bottom of form as implemented.
