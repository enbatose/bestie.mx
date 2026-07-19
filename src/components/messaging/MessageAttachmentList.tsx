import { apiBase } from "@/lib/apiBase";

export type MessageAttachmentLike = { url: string; filename: string };

function absoluteAttachmentUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${apiBase()}${url}`;
}

/** Thumbnail grid for attachments already sent on a message. */
export function MessageAttachmentList({ attachments }: { attachments: MessageAttachmentLike[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a, i) => (
        <a
          key={`${a.url}-${i}`}
          href={absoluteAttachmentUrl(a.url)}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <img
            src={absoluteAttachmentUrl(a.url)}
            alt={a.filename || "Adjunto"}
            className="size-20 rounded-lg border border-border object-cover"
          />
        </a>
      ))}
    </div>
  );
}
