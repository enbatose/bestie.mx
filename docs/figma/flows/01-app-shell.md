# 01 — App shell (header, footer, modal host)

## Figma frames

- `Shell · header · logged out`
- `Shell · header · logged in`
- `Shell · header · mobile drawer open`
- `Shell · footer`
- `Shell · main placeholder` (empty content area showing max width)

## Route / scope

Wraps **all** main routes. Layout: `src/layouts/AppShellLayout.tsx`.

## User goals

- Navigate anywhere from the brand + menu.
- See unread messages when logged in.
- Open auth without leaving the current page (modal).
- Reach support links from the footer.

## Layout zones

| Zone | Contents |
| --- | --- |
| Header (sticky) | `BrandLogo`, `HeaderMegaMenu` |
| Main | `<Outlet />` — replace with your screen frame when designing a flow |
| Footer | `BrandLogo`, copyright, mailto, links to Contacto / FAQ / Legal |

## Components to define in Figma

- `Logo/Bestie` (on-light + on-dark variants if needed)
- `Nav/MegaMenuDesktop`, `Nav/MobileMenu` (sheet or full-screen)
- `Nav/Link`, `Nav/SectionLabel` (uppercase muted labels: Explorar, Publicar, …)
- `Badge/UnreadMessages`
- `Badge/ProfileIncomplete` (warning dot on Perfil)
- `Footer/Standard`

## Flows in / out

- **In:** any deep link; shell is always present.
- **Out:** every route in [FLOW-INDEX](./FLOW-INDEX.md); header triggers `AuthModal` without route change.

## Notes

- `profileIncomplete`: show warning affordance on Perfil when user has email but no phone (`me.email && !me.phoneE164`).
- Admin link visibility: only for `me.isAdmin` (see `SignInPage` / header behavior).
