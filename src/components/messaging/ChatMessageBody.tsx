import { Link } from "react-router-dom";
import { listingPublicPath } from "@/lib/listingReference";

/** Markdown-style relative links: [label](/path) */
const MD_LINK_RE = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;

/**
 * Legacy feedback lines: "Title (uuid)" — keep title visible, hide id, link to listing.
 * Matches optional leading bullet markers already handled by surrounding text.
 */
const TITLE_UUID_RE =
  /([^(\n]+?)\s+\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

type Segment =
  | { type: "text"; value: string }
  | { type: "link"; label: string; to: string };

function segmentMarkdownLinks(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  MD_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_LINK_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "link", label: m[1]!, to: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out.length ? out : [{ type: "text", value: text }];
}

function segmentLegacyTitleIds(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  TITLE_UUID_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TITLE_UUID_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    const id = m[2]!;
    const rawLabel = m[1]!.trim();
    const label =
      rawLabel.replace(/^·\s*/, "").replace(/^-\s*Publicación:\s*/i, "").trim() || id;
    out.push({ type: "link", label, to: listingPublicPath(id) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out.length ? out : [{ type: "text", value: text }];
}

function expandSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    if (seg.type === "link") {
      out.push(seg);
      continue;
    }
    // Only apply legacy uuid linkify on plain text that has no markdown links already.
    out.push(...segmentLegacyTitleIds(seg.value));
  }
  return out;
}

/**
 * Renders chat message body with clickable listing links (markdown + legacy title(uuid)).
 */
export function ChatMessageBody({
  body,
  className = "",
  linkClassName = "font-semibold underline underline-offset-2 hover:opacity-90",
}: {
  body: string;
  className?: string;
  linkClassName?: string;
}) {
  if (!body) return null;
  const segments = expandSegments(segmentMarkdownLinks(body));
  return (
    <p className={`ph-no-capture whitespace-pre-wrap ${className}`.trim()}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <Link key={i} to={seg.to} className={linkClassName}>
            {seg.label}
          </Link>
        ),
      )}
    </p>
  );
}
