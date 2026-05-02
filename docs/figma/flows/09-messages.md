# 09 — Messages (inbox + thread)

## Figma frames

- `Mensajes · logged out`
- `Mensajes · empty inbox`
- `Mensajes · inbox + thread · desktop`
- `Mensajes · inbox + thread · mobile` (stacked)
- `Mensajes · sending error`

## Route

`/mensajes` with optional `?c=:conversationId`

## Implementation

`src/pages/MessagesPage.tsx`

## User goals

- See conversations list and open one.
- Read thread and send text messages.
- Deep link from listing contact with `c` query param.

## Layout zones

| Zone | Contents |
| --- | --- |
| Left / top | Conversation list (`ConversationSummary`) |
| Right / bottom | Active thread header, message list, composer |
| Auth gate | CTA to `/entrar` when `!me` |

## Components

- `Messages/ConversationList`
- `Messages/ConversationRow` (title, preview, time)
- `Messages/Bubble` (self vs other)
- `Messages/Composer` (textarea + send)
- `State/LoadingThread`

## Flows in

- From [04-listing-detail](./04-listing-detail.md) after `startConversationFromListing`.

## Flows out

- Changing `c` updates thread (same page).
