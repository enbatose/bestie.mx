import type { DatabaseSync } from "node:sqlite";
import { incrementAnalyticsDaily } from "./streetViewAnalytics.js";

export const IMAGE_PIPELINE_EVENT = "image_pipeline";

type ClientEventRow = {
  id: string;
  created_at: number | bigint;
  publisher_id: string;
  user_id: string | null;
  payload_json: string;
};

function asRecord(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Roll up daily success/fail counters from an image_pipeline event. */
export function recordImagePipelineDaily(db: DatabaseSync, payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const p = payload as { ok?: unknown; step?: unknown; errorCode?: unknown; source?: unknown };
  const day = new Date().toISOString().slice(0, 10);
  const ok = p.ok === true;
  const step = typeof p.step === "string" ? p.step.slice(0, 32) : "unknown";
  incrementAnalyticsDaily(db, day, "image_pipeline_events", ok ? "ok" : "fail");
  incrementAnalyticsDaily(db, day, "image_pipeline_step", `${step}:${ok ? "ok" : "fail"}`);
  if (!ok && typeof p.errorCode === "string" && p.errorCode) {
    incrementAnalyticsDaily(db, day, "image_pipeline_error", p.errorCode.slice(0, 64));
  }
  if (typeof p.source === "string" && p.source) {
    incrementAnalyticsDaily(db, day, "image_pipeline_source", `${p.source.slice(0, 32)}:${ok ? "ok" : "fail"}`);
  }
}

export function buildImageUploadAnalytics(
  db: DatabaseSync,
  opts: { hours?: number; limit?: number; failuresOnly?: boolean } = {},
): {
  windowHours: number;
  summary: {
    total: number;
    ok: number;
    fail: number;
    byStep: Record<string, { ok: number; fail: number }>;
    byErrorCode: Record<string, number>;
    bySource: Record<string, { ok: number; fail: number }>;
    mobileFailRate: number | null;
  };
  today: { ok: number; fail: number; topErrors: { code: string; count: number }[] };
  events: {
    id: string;
    createdAt: string;
    publisherId: string;
    userId: string | null;
    step: string | null;
    ok: boolean | null;
    errorCode: string | null;
    error: string | null;
    source: string | null;
    surface: string | null;
    declaredMime: string | null;
    sniffedMime: string | null;
    decodePath: string | null;
    nameExt: string | null;
    nameKind: string | null;
    inputBytes: number | null;
    ms: number | null;
    mobileLike: boolean | null;
    httpStatus: number | null;
  }[];
} {
  const hours = Math.min(168, Math.max(1, opts.hours ?? 48));
  const limit = Math.min(200, Math.max(1, opts.limit ?? 80));
  const since = Date.now() - hours * 3600_000;

  const rows = db
    .prepare(
      `SELECT id, created_at, publisher_id, user_id, payload_json
       FROM client_events
       WHERE name = ? AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 500`,
    )
    .all(IMAGE_PIPELINE_EVENT, since) as ClientEventRow[];

  const byStep: Record<string, { ok: number; fail: number }> = {};
  const byErrorCode: Record<string, number> = {};
  const bySource: Record<string, { ok: number; fail: number }> = {};
  let total = 0;
  let okN = 0;
  let failN = 0;
  let mobileTotal = 0;
  let mobileFail = 0;

  const mapped = rows.map((row) => {
    const p = asRecord(row.payload_json);
    const ok = bool(p.ok);
    const step = str(p.step, 32);
    const source = str(p.source, 32);
    const errorCode = str(p.errorCode, 64);
    const mobileLike = bool(p.mobileLike);

    if (ok !== null && (step === "convert" || step === "upload" || step === "persist" || step === "full")) {
      total += 1;
      if (ok) okN += 1;
      else failN += 1;
      const sk = step || "unknown";
      byStep[sk] = byStep[sk] ?? { ok: 0, fail: 0 };
      if (ok) byStep[sk].ok += 1;
      else byStep[sk].fail += 1;
      if (source) {
        bySource[source] = bySource[source] ?? { ok: 0, fail: 0 };
        if (ok) bySource[source].ok += 1;
        else bySource[source].fail += 1;
      }
      if (!ok && errorCode) byErrorCode[errorCode] = (byErrorCode[errorCode] ?? 0) + 1;
      if (mobileLike) {
        mobileTotal += 1;
        if (!ok) mobileFail += 1;
      }
    }

    return {
      id: row.id,
      createdAt: new Date(Number(row.created_at)).toISOString(),
      publisherId: row.publisher_id,
      userId: row.user_id,
      step,
      ok,
      errorCode,
      error: str(p.error, 280),
      source,
      surface: str(p.surface, 40),
      declaredMime: str(p.declaredMime, 64) ?? str(p.inputType, 64),
      sniffedMime: str(p.sniffedMime, 64),
      decodePath: str(p.decodePath, 32),
      nameExt: str(p.nameExt, 16),
      nameKind: str(p.nameKind, 24),
      inputBytes: num(p.inputBytes),
      ms: num(p.ms),
      mobileLike,
      httpStatus: num(p.httpStatus),
    };
  });

  const events = (opts.failuresOnly ? mapped.filter((e) => e.ok === false) : mapped).slice(0, limit);

  const day = new Date().toISOString().slice(0, 10);
  const todayOk =
    (
      db
        .prepare(`SELECT value FROM analytics_daily WHERE day = ? AND metric = 'image_pipeline_events' AND dimension = 'ok'`)
        .get(day) as { value?: number } | undefined
    )?.value ?? 0;
  const todayFail =
    (
      db
        .prepare(`SELECT value FROM analytics_daily WHERE day = ? AND metric = 'image_pipeline_events' AND dimension = 'fail'`)
        .get(day) as { value?: number } | undefined
    )?.value ?? 0;
  const errorRows = db
    .prepare(
      `SELECT dimension as code, value as count FROM analytics_daily
       WHERE day = ? AND metric = 'image_pipeline_error'
       ORDER BY value DESC LIMIT 8`,
    )
    .all(day) as { code: string; count: number }[];

  return {
    windowHours: hours,
    summary: {
      total,
      ok: okN,
      fail: failN,
      byStep,
      byErrorCode,
      bySource,
      mobileFailRate: mobileTotal > 0 ? mobileFail / mobileTotal : null,
    },
    today: {
      ok: todayOk,
      fail: todayFail,
      topErrors: errorRows.map((r) => ({ code: r.code, count: r.count })),
    },
    events,
  };
}
