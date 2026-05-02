# Screen-by-screen UI flows (Figma-ready)

These documents describe each **screen** (and major sub-step) in `bestie.mx` so you can build **one Figma frame per screen**, attach **components** to repeated UI, and later map frames back into the React app.

| Order | Figma page suggestion | Doc | Route / context |
| --- | --- | --- | --- |
| 0 | `00 · Conventions` | [00-figma-conventions.md](./00-figma-conventions.md) | Naming, variants, dev handoff |
| 1 | `01 · Shell` | [01-app-shell.md](./01-app-shell.md) | All routes (header, footer, modal host) |
| 2 | `02 · Marketing` | [02-home.md](./02-home.md) | `/` |
| 3 | `03 · Buscar` | [03-search.md](./03-search.md) | `/buscar` |
| 4 | `04 · Anuncio` | [04-listing-detail.md](./04-listing-detail.md) | `/anuncio/:id` |
| 5 | `05 · Propiedad` | [05-property.md](./05-property.md) | `/propiedad/:id` |
| 6 | `06 · Auth overlay` | [06-auth-modal.md](./06-auth-modal.md) | Global modal (email login/register) |
| 7 | `07 · Entrar` | [07-sign-in.md](./07-sign-in.md) | `/entrar` |
| 8 | `08 · Registro` | [08-register.md](./08-register.md) | `/registro` |
| 9 | `09 · Mensajes` | [09-messages.md](./09-messages.md) | `/mensajes` |
| 10 | `10 · Mis anuncios` | [10-my-listings.md](./10-my-listings.md) | `/mis-anuncios` |
| 11 | `11 · Publicar` | [11-publish-wizard.md](./11-publish-wizard.md) | `/publicar` (multi-step) |
| 12 | `12 · Perfil` | [12-profile.md](./12-profile.md) | `/perfil` |
| 13 | `13 · Editar cuenta` | [13-account-edit.md](./13-account-edit.md) | `/perfil/editar` |
| 14 | `14 · Grupos` | [14-groups.md](./14-groups.md) | `/grupos` |
| 15 | `15 · Soporte` | [15-contact-faq-legal.md](./15-contact-faq-legal.md) | `/contacto`, `/faq`, `/legal` |
| 16 | `16 · Admin` | [16-admin.md](./16-admin.md) | `/admin` |

**Board-level diagram:** still use [`../bestie-user-flows.svg`](../bestie-user-flows.svg) for a single importable flow map; these markdown files are the **per-screen spec** layer.

**Route source of truth:** `src/App.tsx` (`createBrowserRouter`).
