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
| `email.received` | Email | **Forward `contacto@bestie.mx` → `batani.enrique@gmail.com`** | — |
| `domain.created` | Domain | Logs | Audit when domains are added in Resend |
| `domain.updated` | Domain | Logs | Track tracking/DNS setting changes |
| `domain.deleted` | Domain | Logs | Alert if domain removed accidentally |

Handler behavior today: verify Svix signature → log event → for `email.received` to `contacto@bestie.mx`, **compose a new message** (subject prefixed `[Externo: <real sender>]` + a red "⚠️ Mensaje EXTERNO" banner naming the original sender/subject, body = original content) and send it via `sendTransactionalEmail()` → `200 OK`.

This intentionally does **not** use Resend's raw `emails.receiving.forward()` helper anymore. That raw forward relays the original message essentially unchanged but with the visible `From` rewritten to `Bestie Contacto <contacto@bestie.mx>` — which hides the real external sender and made a "Meta account suspension" phishing email (actually from a random `.edu.ng` address) look like a legitimate Bestie-internal message. The composed forward always exposes the true original sender before you even open it.

Planned: persist bounces/suppressions and auto-disable `email_notify` on saved searches.

## Inbound mail — `contacto@bestie.mx` only

Resend receives any `@bestie.mx` address once domain **receiving** is enabled and the apex MX record is published, but Bestie **only forwards** `contacto@bestie.mx` (the only published support address).

- MX `@` → `inbound-smtp.us-east-1.amazonaws.com` (priority 10) — added via `scripts/cloudflare-setup.mjs`
- Resend domain `bestie.mx`: receiving **enabled**
- Forward target env: `RESEND_CONTACT_FORWARD_TO` (default `batani.enrique@gmail.com`)
- Forward from: the composed forward always sends via `sendTransactionalEmail()`'s normal sender
  (`Bestie MX <no-reply@bestie.mx>` / `EMAIL_FROM`) — never `contacto@bestie.mx` — so the visible
  From can't be mistaken for the original external sender. `resolveContactForwardFrom()` in
  `resendWebhook.ts` is now dead/legacy (kept only so old tests / the manual reforward script still
  compile); `scripts/resend-reforward-inbound.mjs` defaults `RESEND_CONTACT_FORWARD_FROM` to
  `Bestie <no-reply@bestie.mx>` for the same reason.
- Receiving API key env: `RESEND_RECEIVING_API_KEY` (**full_access** — **required on Railway**)
  - Do **not** use sending-only `RESEND_API_KEY` for inbound; the webhook ignores it for receiving/forward
  - Local fallback: `RESEND_ADMIN_API_KEY` (full_access) is accepted for receiving only when `RESEND_RECEIVING_API_KEY` is unset
- Push to Railway: `npm run railway:set-resend-env` (requires receiving/admin full_access key in `server/.env`)

### Health probes (boot)

`GET /api/health` → `resendInbound`:

| Field | Meaning |
|-------|---------|
| `webhookConfigured` | `RESEND_WEBHOOK_SECRET` present |
| `receivingKeyConfigured` | `RESEND_RECEIVING_API_KEY` or `RESEND_ADMIN_API_KEY` present |
| `receivingProbeOk` | Boot probe: receiving API list succeeded |
| `spfOk` | Live DNS: `send.bestie.mx` TXT includes `amazonses.com` |
| `forwardTo` | Gmail (or configured) target |
| `inboundAddresses` | Always `["contacto@bestie.mx"]` |

If forward fails at runtime, the webhook returns `500` (Resend retries) and sends a rate-limited alert email to `forwardTo` (max ~1 / 15 min).

### SPF for forwards (critical)

Resend sends (including **inbound forwards**) use return-path on `send.bestie.mx`. That TXT **must** be:

```text
v=spf1 include:amazonses.com ~all
```

A bare `v=spf1` (no `include:amazonses.com`) fails SPF. With apex DMARC `p=quarantine`, Gmail often **quarantines or hides** the forward — Facebook/Meta validation mail can look like it “never arrived.”

Even with SPF OK, check Gmail **Spam / Promotions** for `Bestie Contacto`.

Check: `npm run resend:validate` (DNS SPF probe) or `/api/health` → `resendInbound.spfOk`.

Fix: edit Cloudflare TXT `send`, or re-run `npm run cloudflare:setup` (updates mismatched TXT; requires `CLOUDFLARE_API_TOKEN` in `server/.env`).

### Ops: list / re-forward stuck inbound

```bash
# List recent received (needs full_access key in server/.env)
RESEND_VALIDATE_LIST=1 npm run resend:validate
# or
node --env-file=server/.env scripts/resend-validate.mjs --list

# Re-send matching contacto@ inbound to Gmail (dry-run first)
node --env-file=server/.env scripts/resend-reforward-inbound.mjs --dry-run
# Meta/Facebook only (validation / business verification mail)
node --env-file=server/.env scripts/resend-reforward-inbound.mjs --meta-only
node --env-file=server/.env scripts/resend-reforward-inbound.mjs
```

Fetches the original body via `GET /emails/receiving/:id`, then composes and sends a new message with `emails.send` (same "show the real sender" behavior as the live webhook path — see above). Does not use the raw `emails.receiving.forward` helper.

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
| `email.received` | Yes | Forward `contacto@bestie.mx` only |

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
