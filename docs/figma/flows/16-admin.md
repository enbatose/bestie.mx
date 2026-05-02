# 16 — Admin

## Figma frames

- `Admin · access denied / error`
- `Admin · tab Usuarios`
- `Admin · tab Ciudades`
- `Admin · tab Métricas`
- `Admin · tab Propiedad` (moderation tools)

## Route

`/admin`

## Implementation

`src/pages/AdminPage.tsx`  
Tabs: `users` | `cities` | `analytics` | `property`

## User goals

- Admin-only: list users, edit featured cities text, view analytics summary, patch property status by ID.

## Layout zones

| Zone | Contents |
| --- | --- |
| Header | Title, access explanation, compliance JSON link |
| Tab bar | Four pill tabs |
| Panel | Tab-specific tables/forms |

## Components

- `Admin/TabBar`
- `Admin/UserList`
- `Admin/FeaturedCitiesEditor` (multiline)
- `Admin/AnalyticsSummary`
- `Admin/PropertyStatusForm`

## Flows in

- Header link visible only for admins (`me.isAdmin`).

## Note

Non-admin users see error from failed API load — design **single error panel** reused from other pages if desired.
