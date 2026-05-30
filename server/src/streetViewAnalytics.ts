import type { DatabaseSync } from "node:sqlite";
import {
  DYNAMIC_STREET_VIEW_FREE_MONTHLY,
  DYNAMIC_STREET_VIEW_USD_PER_1000,
  estimateDynamicStreetViewOverageUsd,
  GOOGLE_MAPS_PRICING_LAST_VERIFIED,
  GOOGLE_MAPS_PRICING_SOURCE,
} from "./googleMapsPricing.js";

export const DYNAMIC_STREET_VIEW_METRIC = "dynamic_street_view_sessions";
export const STREET_VIEW_EMBED_LOCKED_METRIC = "street_view_embed_locked";

export const STREET_VIEW_EVENT_DYNAMIC = "dynamic_street_view_session";
export const STREET_VIEW_EVENT_EMBED_LOCKED = "street_view_embed_locked";

const STREET_VIEW_EVENT_METRICS: Record<string, string> = {
  [STREET_VIEW_EVENT_DYNAMIC]: DYNAMIC_STREET_VIEW_METRIC,
  [STREET_VIEW_EVENT_EMBED_LOCKED]: STREET_VIEW_EMBED_LOCKED_METRIC,
};

export function streetViewMetricForEvent(name: string): string | null {
  return STREET_VIEW_EVENT_METRICS[name] ?? null;
}

export function incrementAnalyticsDaily(
  db: DatabaseSync,
  day: string,
  metric: string,
  dimension: string,
  delta = 1,
): void {
  db.prepare(
    `INSERT INTO analytics_daily (day, metric, dimension, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(day, metric, dimension) DO UPDATE SET value = value + excluded.value`,
  ).run(day, metric, dimension, delta);
}

export function parseStreetViewInterface(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const iface = (payload as { interface?: unknown }).interface;
  return typeof iface === "string" ? iface.trim().slice(0, 64) : "";
}

export function parseMonthParam(raw: unknown): { month: string; monthStart: string; monthEnd: string } | null {
  const month =
    typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw.trim())
      ? raw.trim()
      : new Date().toISOString().slice(0, 7);
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  const monthStart = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { month, monthStart, monthEnd };
}

function sumMetricByDimension(
  db: DatabaseSync,
  metric: string,
  monthStart: string,
  monthEnd: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT dimension, SUM(value) AS total FROM analytics_daily
       WHERE metric = ? AND day >= ? AND day <= ?
       GROUP BY dimension`,
    )
    .all(metric, monthStart, monthEnd) as { dimension: string; total: number }[];
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.dimension || "unknown"] = row.total;
  }
  return out;
}

function sumMetricTotal(db: DatabaseSync, metric: string, monthStart: string, monthEnd: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(value), 0) AS total FROM analytics_daily
       WHERE metric = ? AND day >= ? AND day <= ?`,
    )
    .get(metric, monthStart, monthEnd) as { total: number };
  return row.total;
}

function dailyDynamicTotals(
  db: DatabaseSync,
  monthStart: string,
  monthEnd: string,
): { day: string; total: number }[] {
  return db
    .prepare(
      `SELECT day, SUM(value) AS total FROM analytics_daily
       WHERE metric = ? AND day >= ? AND day <= ?
       GROUP BY day
       ORDER BY day`,
    )
    .all(DYNAMIC_STREET_VIEW_METRIC, monthStart, monthEnd) as { day: string; total: number }[];
}

export function buildStreetViewAnalyticsResponse(db: DatabaseSync, monthParam: unknown) {
  const parsed = parseMonthParam(monthParam);
  if (!parsed) {
    return null;
  }
  const { month, monthStart, monthEnd } = parsed;
  const dynamicByInterface = sumMetricByDimension(db, DYNAMIC_STREET_VIEW_METRIC, monthStart, monthEnd);
  const dynamicTotal = sumMetricTotal(db, DYNAMIC_STREET_VIEW_METRIC, monthStart, monthEnd);
  const embedByInterface = sumMetricByDimension(db, STREET_VIEW_EMBED_LOCKED_METRIC, monthStart, monthEnd);
  const embedTotal = sumMetricTotal(db, STREET_VIEW_EMBED_LOCKED_METRIC, monthStart, monthEnd);
  const billableOverage = Math.max(0, dynamicTotal - DYNAMIC_STREET_VIEW_FREE_MONTHLY);

  return {
    month,
    monthStart,
    monthEnd,
    dynamicStreetView: {
      total: dynamicTotal,
      freeTierLimit: DYNAMIC_STREET_VIEW_FREE_MONTHLY,
      billableOverage,
      estimatedOverageUsd: estimateDynamicStreetViewOverageUsd(dynamicTotal),
      byInterface: dynamicByInterface,
      daily: dailyDynamicTotals(db, monthStart, monthEnd),
    },
    lockedEmbedViews: {
      total: embedTotal,
      byInterface: embedByInterface,
    },
    pricing: {
      sourceUrl: GOOGLE_MAPS_PRICING_SOURCE,
      lastVerified: GOOGLE_MAPS_PRICING_LAST_VERIFIED,
      dynamicStreetViewUsdPer1000: DYNAMIC_STREET_VIEW_USD_PER_1000,
      note: "Internal counter; reconcile with GCP Billing monthly.",
    },
  };
}
