# Resend webhooks — Bestie.mx

Production endpoint: `POST https://www.bestie.mx/api/resend/webhook`  
Handler: `server/src/resendWebhook.ts`  
Env: `RESEND_WEBHOOK_SECRET` (Railway + local `server/.env`)

Resend webhook ID (production): `59c91b7b-d3bb-420a-a2b0-9c9cf46143fe`  
Docs: [Resend webhooks](https://resend.com/docs/webhooks/introduction)

---

## Currently subscribed (production)

These events are enabled on the Bestie webhook as of 2026-06-28.

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
| `domain.created` | Domain | Logs | Audit when domains are added in Resend |
| `domain.updated` | Domain | Logs | Track tracking/DNS setting changes |
| `domain.deleted` | Domain | Logs | Alert if domain removed accidentally |

Handler behavior today: verify Svix signature → log event → `200 OK`.  
Planned: persist bounces/suppressions and auto-disable `email_notify` on saved searches.

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
| `email.received` | **No** | Inbound mail (`support@bestie.mx`), reply parsing, helpdesk |

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
