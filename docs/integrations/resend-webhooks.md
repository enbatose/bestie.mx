# Resend webhooks — Bestie.mx

Production endpoint: `POST https://www.bestie.mx/api/resend/webhook`  
Dev endpoint: `POST https://dev.bestie.mx/api/resend/webhook` (outbound events only — no `email.received`, so inbound `contacto@` stays Prod-only)  
Handler: `server/src/resendWebhook.ts`  
Env: `RESEND_WEBHOOK_SECRET` (per Railway service + local `server/.env`)

Resend webhook ID (production): `59c91b7b-d3bb-420a-a2b0-9c9cf46143fe`  
Resend webhook ID (dev): `4ab79503-a04a-411b-983d-89d10efcdc85`  
Docs: [Resend webhooks](https://resend.com/docs/webhooks/introduction)

---

## Currently subscribed (production)

These events are enabled on the Bestie webhook as of 2026-07-04.

| Event | Category | Bestie use today | Future product ideas |
|-------|----------|------------------|----------------------|
| `email.sent` | Email | Logs / audit | Store `email_id` when sending saved-search mail; reconcile send vs deliver |
| `email.scheduled` | Email | Logs | Weekly digest / delayed alert batches |
| `email.delivered` | Email | Logs | Support: “did the alert arrive?” |
| `email.delivery_delayed` | Email | Logs | Ops when provider delays delivery |
| `email.opened` | Email | Logs | Alert engagement metrics |
| `email.clicked` | Email | Logs | Which listings get clicks from alerts |
| `email.bounced` | Email | Logs | **Disable saved-search email** for bad addresses |
| `email.complained` | Email | Logs | **Disable notifications**; protect domain reputation |
| `email.failed` | Email | Logs | Retry / alert ops |
| `email.suppressed` | Email | Logs | **Stop sending** to suppressed recipients |
| `email.received` | Email | **Forward `contacto@bestie.mx` → `batani.enrique@gmail.com`** | Inbound helpdesk for other addresses |
| `domain.created` | Domain | Logs | Audit when domains are added in Resend |
| `domain.updated` | Domain | Logs | Track tracking/DNS setting changes |
| `domain.deleted` | Domain | Logs | Alert if domain removed accidentally |

Handler behavior today: verify Svix signature → log event → for `email.received` to `contacto@bestie.mx`, call `resend.emails.receiving.forward()` → `200 OK`.  
Planned: persist bounces/suppressions and auto-disable `email_notify` on saved searches.

## Inbound mail — `contacto@bestie.mx`

Resend receives any `@bestie.mx` address once domain **receiving** is enabled and the apex MX record is published:

- MX `@` → `inbound-smtp.us-east-1.amazonaws.com` (priority 10) — added via `scripts/cloudflare-setup.mjs`
- Resend domain `bestie.mx`: receiving **enabled**
- Forward target env: `RESEND_CONTACT_FORWARD_TO` (default `batani.enrique@gmail.com`)
- Forward from env: `RESEND_CONTACT_FORWARD_FROM` (default `Bestie Contacto <contacto@bestie.mx>`)
- Receiving API key env: `RESEND_RECEIVING_API_KEY` (**full_access** — required on Railway; `RESEND_API_KEY` sending-only returns 401 on forward)
- Also forwarded (same inbox): `soporte@`, `support@`, `privacy@` @bestie.mx

Production must use `getResendReceivingApiKey()` in `server/src/resendWebhook.ts` (prefers `RESEND_RECEIVING_API_KEY`).

### SPF for forwards (critical)

Resend sends (including **inbound forwards**) use return-path on `send.bestie.mx`. That TXT **must** be:

```text
v=spf1 include:amazonses.com ~all
```

A bare `v=spf1` (no `include:amazonses.com`) fails SPF. With apex DMARC `p=quarantine`, Gmail often **quarantines or hides** the forward — Facebook/Meta validation mail can look like it “never arrived.”

Check: `npm run resend:validate` (DNS SPF probe) or:

```bash
dig +short TXT send.bestie.mx
```

Fix: edit Cloudflare TXT `send`, or re-run `npm run cloudflare:setup` (updates mismatched TXT; requires `CLOUDFLARE_API_TOKEN` in `server/.env`).

### Ops: list / re-forward stuck inbound

```bash
# List recent received (needs full_access key in server/.env)
RESEND_VALIDATE_LIST=1 npm run resend:validate
# or
node --env-file=server/.env scripts/resend-validate.mjs --list

# Re-send matching inbound to Gmail (dry-run first)
node --env-file=server/.env scripts/resend-reforward-inbound.mjs --dry-run
node --env-file=server/.env scripts/resend-reforward-inbound.mjs
```

Health (prod): `GET https://www.bestie.mx/api/health` → `resendInbound.webhookConfigured` / `receivingKeyConfigured` / `forwardTo`.

---

## Full Resend webhook inventory (not all subscribed)

Use this table when designing features — propose adding events only when there is a concrete handler.

### Email events

| Event | Subscribed? | When to add for Bestie |
|-------|-------------|------------------------|
| `email.sent` | Yes | — |
| `email.scheduled` | Yes | — |
| `email.delivered` | Yes | — |
| `email.delivery_delayed` | Yes | — |
| `email.opened` | Yes | — |
| `email.clicked` | Yes | — |
| `email.bounced` | Yes | — |
| `email.complained` | Yes | — |
| `email.failed` | Yes | — |
| `email.suppressed` | Yes | — |
| `email.received` | Yes | Forward `contacto@bestie.mx`; extend for other inbound addresses |

### Contact events (marketing / audiences)

| Event | Subscribed? | When to add for Bestie |
|-------|-------------|------------------------|
| `contact.created` | **No** | Newsletter waitlist, landlord CRM, Resend Audiences |
| `contact.updated` | **No** | Preference center, segment sync |
| `contact.deleted` | **No** | GDPR erasure audit trail |

### Domain events

| Event | Subscribed? | When to add for Bestie |
|-------|-------------|------------------------|
| `domain.created` | Yes | — |
| `domain.updated` | Yes | — |
| `domain.deleted` | Yes | — |

---

## Updating the webhook

- **Dashboard:** Resend → Webhooks → edit endpoint events  
- **MCP:** `update-webhook` on `user-resend` (full-access key)  
- After changing events, update the **Currently subscribed** table in this file

## Related

- Sending: `server/src/mailer.ts`, `RESEND_API_KEY`, `EMAIL_FROM`
- Saved-search emails: `server/src/savedSearchNotify.ts`
- Quota logging: `logResendSendError()` in `mailer.ts`
- Validate keys: `npm run resend:validate`
