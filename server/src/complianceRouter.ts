import express, { type Request, type Response } from "express";

/** D4 — product commitment: admin must never impersonate end users. */
export function complianceRouter() {
  const r = express.Router();
  r.get("/no-impersonation", (_req: Request, res: Response) => {
    res.json({
      policy: "no_user_impersonation",
      summary:
        "Bestie does not provide admin login-as-user, session takeover, or any API that acts as another user.",
      repository: "https://github.com/enbatose/bestie.mx",
    });
  });
  return r;
}
