# 07 — Sign in (full page)

## Figma frames

- `Entrar · tabs · WhatsApp`
- `Entrar · tabs · Correo`
- `Entrar · OTP entry` (after request)
- `Entrar · already signed in` (summary + links: Publicar, Grupos, Admin if admin)
- `Entrar · registration notice` (banner when `location.state.registrationNotice`)

## Route

`/entrar`

## Implementation

`src/pages/SignInPage.tsx`  
APIs: `authWhatsAppRequest`, `authWhatsAppVerify`, `authLogin`, `authLogout`, `authMe`, `authLinkPublisher`

## User goals

- Sign in with **WhatsApp OTP** or **email/password**.
- Link publisher account when applicable.

## Layout zones

| Zone | Contents |
| --- | --- |
| Title + intro | H1 “Entrar”, explanatory copy |
| Segmented control | WhatsApp | Correo |
| WhatsApp panel | Phone, request code, OTP field, verify |
| Email panel | Email, password, submit |
| Signed-in panel | Quick links (Publicar, Grupos, Admin) |

## Components

- `Tabs/Pill` (two options)
- `Form/WhatsAppLogin`
- `Form/EmailLogin`
- `Message/DevHint` (optional dev-only OTP hint — may be empty in prod designs)

## Flows out

- **Mis anuncios** — common post-login navigation patterns in app; full page register → `/registro` link from this page as implemented.
