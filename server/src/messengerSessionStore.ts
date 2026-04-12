import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type MessengerSearchDraft = {
  q: string;
  city: string | null;
  budgetMax: number | null;
  pref: "female" | "male" | null;
};

const emptyDraft = (): MessengerSearchDraft => ({
  q: "",
  city: null,
  budgetMax: null,
  pref: null,
});

function parseDraft(raw: string): MessengerSearchDraft {
  try {
    const j = JSON.parse(raw) as Partial<MessengerSearchDraft>;
    return {
      q: typeof j.q === "string" ? j.q : "",
      city: typeof j.city === "string" ? j.city : null,
      budgetMax: typeof j.budgetMax === "number" && Number.isFinite(j.budgetMax) ? j.budgetMax : null,
      pref: j.pref === "female" || j.pref === "male" ? j.pref : null,
    };
  } catch {
    return emptyDraft();
  }
}

export type MessengerChatRow = {
  publisherId: string;
  flow: string;
  draft: MessengerSearchDraft;
};

export function getMessengerChat(db: DatabaseSync, psid: string): MessengerChatRow | null {
  const row = db
    .prepare(`SELECT publisher_id, flow, draft_json FROM messenger_chat_sessions WHERE psid = ?`)
    .get(psid) as { publisher_id: string; flow: string; draft_json: string } | undefined;
  if (!row) return null;
  return { publisherId: row.publisher_id, flow: row.flow, draft: parseDraft(row.draft_json) };
}

export function upsertMessengerChat(
  db: DatabaseSync,
  psid: string,
  patch: Partial<{ publisherId: string; flow: string; draft: MessengerSearchDraft }>,
): MessengerChatRow {
  const existing = getMessengerChat(db, psid);
  const publisherId = patch.publisherId ?? existing?.publisherId ?? randomUUID();
  const flow = patch.flow ?? existing?.flow ?? "idle";
  const draft = patch.draft ?? existing?.draft ?? emptyDraft();
  const draftJson = JSON.stringify(draft);
  const now = Date.now();
  db.prepare(
    `INSERT INTO messenger_chat_sessions (psid, publisher_id, flow, draft_json, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(psid) DO UPDATE SET
       publisher_id = excluded.publisher_id,
       flow = excluded.flow,
       draft_json = excluded.draft_json,
       updated_at = excluded.updated_at`,
  ).run(psid, publisherId, flow, draftJson, now);
  return { publisherId, flow, draft };
}
