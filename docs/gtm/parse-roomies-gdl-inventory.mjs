import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(dir, "_raw-roomies-gdl-paste.txt"), "utf8");
const lines = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const skipExact = new Set([
  "roomies gdl",
  "Resultados de la búsqueda",
  "Filtros",
  "Guadalajara",
  "Cerca de mí",
  "Grupos públicos",
  "Mis grupos",
]);

const metaRe = /^(Público|Privado)\s*·/;
const friendsRe = /^\d+\s+amigos?\s+(es|son)\s+miembros?$/i;
const belongRe = /^Perteneces a este grupo$/i;

function parseMembersApprox(part) {
  const m = part.match(/([\d.,]+)\s*(mil)?\s*miembros/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(",", "."));
  if (m[2]) n *= 1000;
  return Math.round(n);
}

function classify(name) {
  const n = name.toLowerCase();
  if (n.includes("malos roomies")) return "D_reputation_not_supply";
  if (n.includes("house exchange")) return "D_off_topic";
  // Roomies / cuartos first — some titles mix rooms + offices/locales.
  if (
    /\broomie|\broomies|\bcuartos?\b|\bhabitacion|\bhabitaciones\b|\brooms?\b|\bstudent|\bestudiantes?\b|\bfor[aá]neos?\b|\bexchange student|\bstudent exchange|\bhospedaje\b|\bbuscocuarto|\baccommodation\b|\broomis\b/.test(
      n,
    )
  ) {
    return "A_roomies_cuartos";
  }
  const offTopic = [
    "rides",
    "trabajo",
    "empleos",
    "muebles",
    "venta de salas",
    "jardineras",
    "restaurantes",
    "bodegas",
    "locales comerciales",
    "locales en renta",
    "consultorio",
    "oficinas en renta",
    "terraza con alberca",
    "gdl amigos",
    "que todo guadalajara se entere",
    "house exchange",
  ];
  if (offTopic.some((k) => n.includes(k))) return "D_off_topic";
  if (/\bainbnb\b|\bhoteles\b/.test(n)) return "C_short_stay";
  if (/\bventa\b/.test(n) && !/\brenta\b/.test(n)) return "C_sales_heavy";
  if (
    /\brenta|\bdepa|\bdepartamentos?\b|\bcasas?\b|\binmuebles?\b|\bhousing\b|\bsin aval\b/.test(
      n,
    )
  ) {
    return "B_general_rentals";
  }
  return "C_other";
}

/** @type {Array<Record<string, string | number>>} */
const groups = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (skipExact.has(line) || friendsRe.test(line) || belongRe.test(line)) {
    i += 1;
    continue;
  }
  if (metaRe.test(line)) {
    i += 1;
    continue;
  }

  const name = line.replace(/^"|"$/g, "");
  let meta = null;
  let j = i + 1;
  if (j < lines.length && metaRe.test(lines[j])) {
    meta = lines[j];
    j += 1;
  }

  let friends = 0;
  let isMember = false;
  while (j < lines.length) {
    if (friendsRe.test(lines[j])) {
      friends = parseInt(lines[j], 10);
      j += 1;
      continue;
    }
    if (belongRe.test(lines[j])) {
      isMember = true;
      j += 1;
      continue;
    }
    break;
  }

  let privacy = "";
  let membersLabel = "";
  let membersApprox = "";
  let activity = "";
  let memberSince = "";
  let unread = "";
  let recentMembers = "";

  if (meta) {
    const parts = meta.split(/\s*·\s*/);
    privacy = parts[0] || "";
    for (const p of parts.slice(1)) {
      const part = p.trim();
      if (/^Miembros recientes$/i.test(part)) {
        recentMembers = "yes";
      } else if (/miembros/i.test(part)) {
        membersLabel = part;
        membersApprox = parseMembersApprox(part) ?? "";
      } else if (/publicaciones al d[ií]a/i.test(part)) {
        activity = part;
      } else if (/publicaci[oó]n(es)? no le[ií]das?/i.test(part)) {
        unread = part;
        // Facebook only surfaces unread counts for groups you belong to.
        isMember = true;
      } else if (/Miembro desde/i.test(part)) {
        memberSince = part.replace(/^Miembro desde\s*/i, "").trim();
        isMember = true;
      }
    }
  }

  groups.push({
    id: groups.length + 1,
    name,
    privacy,
    members_approx: membersApprox,
    members_label: membersLabel,
    activity,
    friends_in_group: friends || "",
    is_member: isMember ? "yes" : "no",
    member_since: memberSince,
    unread_signal: unread,
    recent_members_signal: recentMembers,
    relevance_tier: classify(name),
    search_query: "roomies gdl",
    source_date: "2026-08-01",
    account_observed: "personal (Facebook search UI)",
    notes: "",
  });
  i = j;
}

const seen = new Map();
for (const g of groups) {
  const key = `${String(g.name).toLowerCase()}|${g.privacy}|${g.members_approx}`;
  if (seen.has(key)) {
    g.notes = "possible duplicate row";
  }
  seen.set(key, true);
}

const overridesPath = resolve(dir, "membership-overrides.json");
if (existsSync(overridesPath)) {
  const overrides = JSON.parse(readFileSync(overridesPath, "utf8"));
  const markIds = new Set(
    (overrides.mark_member_ids || []).map((id) => Number(id)),
  );
  const joinNote =
    "joined_or_requested 2026-08-01 (user confirmed; private may be pending)";
  for (const g of groups) {
    if (!markIds.has(Number(g.id))) continue;
    g.is_member = "yes";
    g.notes = g.notes ? `${g.notes}; ${joinNote}` : joinNote;
  }
}

const cols = [
  "id",
  "name",
  "privacy",
  "members_approx",
  "members_label",
  "activity",
  "friends_in_group",
  "is_member",
  "member_since",
  "unread_signal",
  "recent_members_signal",
  "relevance_tier",
  "search_query",
  "source_date",
  "account_observed",
  "notes",
];

function esc(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const csv = [cols.join(",")]
  .concat(groups.map((g) => cols.map((c) => esc(g[c])).join(",")))
  .join("\n");
writeFileSync(resolve(dir, "facebook-groups-gdl-roomies.csv"), csv + "\n");

const byTier = {};
for (const g of groups) {
  const t = String(g.relevance_tier);
  byTier[t] = (byTier[t] || 0) + 1;
}
const members = groups.filter((g) => g.is_member === "yes");
console.log(
  JSON.stringify(
    {
      total: groups.length,
      byTier,
      alreadyMember: members.length,
      memberNames: members.map((m) => m.name),
    },
    null,
    2,
  ),
);
