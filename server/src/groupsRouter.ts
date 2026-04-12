import { randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { readPublisherIdFromRequest, getOrCreatePublisherId } from "./session.js";

function jsonMw() {
  return express.json({ limit: "128kb" });
}

function inviteCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

export function groupsRouter(db: DatabaseSync) {
  const r = express.Router();

  r.post("/", jsonMw(), (req: Request, res: Response) => {
    const pub = readPublisherIdFromRequest(req) ?? getOrCreatePublisherId(req, res);
    const b = req.body as { name?: unknown; minAge?: unknown; maxAge?: unknown; minIncomeMxn?: unknown };
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 200) : "";
    if (name.length < 2) {
      res.status(400).json({ error: "invalid_name" });
      return;
    }
    const minAge = typeof b.minAge === "number" ? Math.floor(b.minAge) : null;
    const maxAge = typeof b.maxAge === "number" ? Math.floor(b.maxAge) : null;
    const minIncome = typeof b.minIncomeMxn === "number" ? Math.floor(b.minIncomeMxn) : null;
    const id = randomUUID();
    let code = inviteCode();
    for (let i = 0; i < 5; i++) {
      try {
        db.prepare(
          `INSERT INTO renter_groups (id, owner_publisher_id, name, min_age, max_age, min_income_mxn, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(id, pub, name, minAge, maxAge, minIncome, code, new Date().toISOString());
        break;
      } catch {
        code = inviteCode();
      }
    }
    db.prepare(`INSERT INTO renter_group_members (group_id, publisher_id, joined_at) VALUES (?, ?, ?)`).run(
      id,
      pub,
      new Date().toISOString(),
    );
    res.status(201).json({ id, name, inviteCode: code });
  });

  r.get("/mine", (req: Request, res: Response) => {
    const pub = readPublisherIdFromRequest(req);
    if (!pub) {
      res.status(401).json({ error: "publisher_session_required" });
      return;
    }
    const rows = db
      .prepare(
        `SELECT g.id, g.name, g.invite_code, g.created_at, g.min_age, g.max_age, g.min_income_mxn,
                (SELECT COUNT(*) FROM renter_group_members m WHERE m.group_id = g.id) AS member_count
         FROM renter_groups g
         WHERE g.owner_publisher_id = ? OR EXISTS (SELECT 1 FROM renter_group_members m WHERE m.group_id = g.id AND m.publisher_id = ?)
         ORDER BY g.created_at DESC`,
      )
      .all(pub, pub) as Record<string, unknown>[];
    res.json(rows);
  });

  r.post("/join", jsonMw(), (req: Request, res: Response) => {
    const pub = readPublisherIdFromRequest(req) ?? getOrCreatePublisherId(req, res);
    const b = req.body as { inviteCode?: unknown };
    const code = typeof b.inviteCode === "string" ? b.inviteCode.trim().toUpperCase() : "";
    if (code.length < 4) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    const g = db.prepare(`SELECT id FROM renter_groups WHERE invite_code = ?`).get(code) as { id: string } | undefined;
    if (!g) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    db.prepare(`INSERT OR IGNORE INTO renter_group_members (group_id, publisher_id, joined_at) VALUES (?, ?, ?)`).run(
      g.id,
      pub,
      new Date().toISOString(),
    );
    res.json({ ok: true, groupId: g.id });
  });

  r.get("/:id", (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id || id.length > 120) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const g = db
      .prepare(
        `SELECT g.id, g.name, g.min_age, g.max_age, g.min_income_mxn, g.invite_code, g.created_at,
                (SELECT COUNT(*) FROM renter_group_members m WHERE m.group_id = g.id) AS member_count
         FROM renter_groups g WHERE g.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!g) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(g);
  });

  return r;
}
