# Production database backups

Bestie prod data lives on Railway volume `bestie-prod-volume` (`/data`: SQLite `bestie.db` + `uploads/`), region **US West**.

## Layers

| Layer | What | Region / home | Retention |
| --- | --- | --- | --- |
| **A. Native Railway volume backups** | Snapshot of prod volume | Same project/env as prod | Daily (6 days) + Weekly (1 month) — enable under **bestie-prod → Backups** if not already on |
| **B. Warm standby volume** | Service `bestie-backup` mounts `/data` with extracted latest + dated copies | **US East** | Latest + **7** daily folders |
| **C. Object store** | Railway Bucket `bestie-prod-backups` | **iad (US East)** | **14** daily + **8** weekly (Sundays) + `latest/` |

Nothing in B/C is wired as an app environment database — redundancy only.

## Schedule

Railway cron is **UTC-only**. Mexico City no longer observes DST (permanent **UTC−6**), so midnight CDMX is **06:00 UTC**. Service `bestie-backup` runs at `0 5,6 * * *` UTC and **only proceeds** when the clock in `America/Mexico_City` is in the **00:00–00:59** hour (the extra UTC hour is a safety net if DST rules ever change).

Flow each night:

1. Cron triggers `POST https://www.bestie.mx/api/internal/backup/run` (Bearer `BACKUP_JOB_SECRET`).
2. Prod takes an online SQLite backup + packs `uploads/`, uploads to the bucket.
3. Cron downloads `latest/` into the US East volume and keeps dated copies.

Failures email `BACKUP_ALERT_TO` (default: same as contact forward / `batani.enrique@gmail.com`).

## Manual / force run

On `bestie-backup`, set `BACKUP_CRON_FORCE=1` for one deploy/run (or run the start command once) to skip the midnight-hour guard. Remove afterward.

## Restore (high level)

1. Prefer a known-good object: `bestie-prod/daily/YYYY-MM-DD/bestie-data.tar.gz` or warm volume `/data/daily/YYYY-MM-DD/`.
2. Extract `bestie.db` + `uploads/` onto a fresh volume at `/data`.
3. Point `bestie-prod` at that volume (`DATABASE_PATH=/data/bestie.db`) and redeploy.
4. Native Railway **Restore** on the Backups tab is also available for same-project volume rollback.

## Cloudflare R2 (optional upgrade)

R2 was preferred for survival outside Railway, but this Cloudflare account did not have R2 enabled yet. After enabling R2 in the [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/r2), create bucket `bestie-prod-backups` (hint `enam`) and point `BACKUP_S3_*` at R2’s S3 endpoint — the same backup code works.
