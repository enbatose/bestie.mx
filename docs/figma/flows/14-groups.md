# 14 — Groups

## Figma frames

- `Grupos · default` (intro + create form)
- `Grupos · list with invite codes`
- `Grupos · join by code`
- `Grupos · error banner`

## Route

`/grupos`

## Implementation

`src/pages/GroupsPage.tsx` — `groupsCreate`, `groupsJoin`, `groupsMine`

## User goals

- Create a roommate group with optional age / income gates.
- Join via invite code.
- Copy or share invite messaging (per UI).

## Layout zones

| Zone | Contents |
| --- | --- |
| Intro | Title, explanation, link to `/publicar` |
| Create form | Name, min/max age, min income (optional) |
| Join form | Invite code field |
| List | My groups with metadata |

## Components

- `Form/GroupCreate`
- `Form/GroupJoin`
- `List/GroupCard`

## Flows out

- **Publicar** — linked from intro for publishers
