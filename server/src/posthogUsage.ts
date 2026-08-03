/**
 * Live PostHog usage for admin cost metrics (session replay + product analytics).
 * Requires `POSTHOG_PERSONAL_API_KEY` (private Query API). Project token (`phc_`) is not enough.
 *
 * @see https://posthog.com/docs/api/queries
 */

import {
  estimatePostHogEventsOverageUsd,
  estimatePostHogRecordingsOverageUsd,
  POSTHOG_BILLING_URL,
  POSTHOG_EVENTS_FREE_MONTHLY,
  POSTHOG_EVENTS_USD_PER_EVENT,
  POSTHOG_PRICING_LAST_VERIFIED,
  POSTHOG_PRICING_SOURCE,
  POSTHOG_PROJECT_ID,
  POSTHOG_QUERY_HOST,
  POSTHOG_RECORDINGS_FREE_MONTHLY,
  POSTHOG_RECORDINGS_USD_EACH,
} from "./vendorUsageLimits.js";

export type PostHogUsageSnapshot = {
  configured: boolean;
  available: boolean;
  error: string | null;
  month: string;
  monthStart: string;
  monthEnd: string;
  recordings: {
    total: number;
    freeTierLimit: number;
    billableOverage: number;
    estimatedOverageUsd: number;
  };
  events: {
    total: number;
    freeTierLimit: number;
    billableOverage: number;
    estimatedOverageUsd: number;
    uniquePersons: number;
  };
  exceptions: {
    total: number;
  };
  pricing: {
    sourceUrl: string;
    billingUrl: string;
    lastVerified: string;
    recordingsUsdEach: number;
    eventsUsdEach: number;
    note: string;
  };
  links: {
    replayHome: string;
    billing: string;
  };
};

type CacheEntry = { at: number; month: string; value: PostHogUsageSnapshot };

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 120_000;

function personalApiKey(): string | null {
  const k =
    process.env.POSTHOG_PERSONAL_API_KEY?.trim() ||
    process.env.POSTHOG_PRIVATE_API_KEY?.trim() ||
    "";
  return k || null;
}

function projectId(): string {
  return process.env.POSTHOG_PROJECT_ID?.trim() || POSTHOG_PROJECT_ID;
}

function queryHost(): string {
  return (process.env.POSTHOG_API_HOST?.trim() || POSTHOG_QUERY_HOST).replace(/\/+$/, "");
}

function emptySnapshot(
  month: string,
  monthStart: string,
  monthEnd: string,
  opts: { configured: boolean; available: boolean; error: string | null },
): PostHogUsageSnapshot {
  return {
    configured: opts.configured,
    available: opts.available,
    error: opts.error,
    month,
    monthStart,
    monthEnd,
    recordings: {
      total: 0,
      freeTierLimit: POSTHOG_RECORDINGS_FREE_MONTHLY,
      billableOverage: 0,
      estimatedOverageUsd: 0,
    },
    events: {
      total: 0,
      freeTierLimit: POSTHOG_EVENTS_FREE_MONTHLY,
      billableOverage: 0,
      estimatedOverageUsd: 0,
      uniquePersons: 0,
    },
    exceptions: { total: 0 },
    pricing: {
      sourceUrl: POSTHOG_PRICING_SOURCE,
      billingUrl: POSTHOG_BILLING_URL,
      lastVerified: POSTHOG_PRICING_LAST_VERIFIED,
      recordingsUsdEach: POSTHOG_RECORDINGS_USD_EACH,
      eventsUsdEach: POSTHOG_EVENTS_USD_PER_EVENT,
      note: "Live HogQL against Bestie production. Billing period may differ slightly from UTC calendar month — reconcile at Organization → Billing.",
    },
    links: {
      replayHome: `https://us.posthog.com/project/${projectId()}/replay/home`,
      billing: POSTHOG_BILLING_URL,
    },
  };
}

async function runHogql(query: string): Promise<unknown[][]> {
  const key = personalApiKey();
  if (!key) throw new Error("posthog_personal_api_key_missing");
  const url = `${queryHost()}/api/projects/${encodeURIComponent(projectId())}/query/`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query },
      }),
      signal: ac.signal,
    });
    const json = (await res.json()) as {
      results?: unknown[][];
      detail?: string;
      error?: string;
    };
    if (!res.ok) {
      const msg = json.detail || json.error || `http_${res.status}`;
      throw new Error(String(msg).slice(0, 200));
    }
    return Array.isArray(json.results) ? json.results : [];
  } finally {
    clearTimeout(timer);
  }
}

function numCell(row: unknown[] | undefined, idx: number): number {
  const v = row?.[idx];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fetch PostHog usage for a UTC calendar month (`YYYY-MM`). Cached ~2 min.
 */
export async function fetchPostHogUsage(
  month: string,
  monthStart: string,
  monthEnd: string,
): Promise<PostHogUsageSnapshot> {
  const key = personalApiKey();
  if (!key) {
    return emptySnapshot(month, monthStart, monthEnd, {
      configured: false,
      available: false,
      error: "missing_personal_api_key",
    });
  }

  const now = Date.now();
  if (cache && cache.month === month && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  // Inclusive day range; end of month day uses < next day via string compare on DateTime.
  const startTs = `${monthStart} 00:00:00`;
  const endExclusive = (() => {
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return `${next} 00:00:00`;
  })();

  try {
    const [recRows, evtRows, excRows] = await Promise.all([
      runHogql(
        `SELECT count(DISTINCT session_id) AS recordings
         FROM raw_session_replay_events
         WHERE min_first_timestamp >= toDateTime('${startTs}')
           AND min_first_timestamp < toDateTime('${endExclusive}')`,
      ),
      runHogql(
        `SELECT count() AS events, uniqExact(person_id) AS persons
         FROM events
         WHERE timestamp >= toDateTime('${startTs}')
           AND timestamp < toDateTime('${endExclusive}')`,
      ),
      runHogql(
        `SELECT count() AS exceptions
         FROM events
         WHERE event = '$exception'
           AND timestamp >= toDateTime('${startTs}')
           AND timestamp < toDateTime('${endExclusive}')`,
      ),
    ]);

    const recordings = numCell(recRows[0], 0);
    const events = numCell(evtRows[0], 0);
    const persons = numCell(evtRows[0], 1);
    const exceptions = numCell(excRows[0], 0);
    const recordingOverage = Math.max(0, recordings - POSTHOG_RECORDINGS_FREE_MONTHLY);
    const eventOverage = Math.max(0, events - POSTHOG_EVENTS_FREE_MONTHLY);

    const value: PostHogUsageSnapshot = {
      configured: true,
      available: true,
      error: null,
      month,
      monthStart,
      monthEnd,
      recordings: {
        total: recordings,
        freeTierLimit: POSTHOG_RECORDINGS_FREE_MONTHLY,
        billableOverage: recordingOverage,
        estimatedOverageUsd: estimatePostHogRecordingsOverageUsd(recordings),
      },
      events: {
        total: events,
        freeTierLimit: POSTHOG_EVENTS_FREE_MONTHLY,
        billableOverage: eventOverage,
        estimatedOverageUsd: estimatePostHogEventsOverageUsd(events),
        uniquePersons: persons,
      },
      exceptions: { total: exceptions },
      pricing: {
        sourceUrl: POSTHOG_PRICING_SOURCE,
        billingUrl: POSTHOG_BILLING_URL,
        lastVerified: POSTHOG_PRICING_LAST_VERIFIED,
        recordingsUsdEach: POSTHOG_RECORDINGS_USD_EACH,
        eventsUsdEach: POSTHOG_EVENTS_USD_PER_EVENT,
        note: "Live HogQL against Bestie production. Billing period may differ slightly from UTC calendar month — reconcile at Organization → Billing.",
      },
      links: {
        replayHome: `https://us.posthog.com/project/${projectId()}/replay/home`,
        billing: POSTHOG_BILLING_URL,
      },
    };
    cache = { at: now, month, value };
    return value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[posthog-usage] ${msg.slice(0, 200)}`);
    return emptySnapshot(month, monthStart, monthEnd, {
      configured: true,
      available: false,
      error: msg.slice(0, 200),
    });
  }
}

/** Test helper — clear in-memory cache between tests. */
export function clearPostHogUsageCache(): void {
  cache = null;
}
