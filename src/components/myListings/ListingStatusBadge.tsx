import type { ListingStatus } from "@/types/listing";

const STATUS_CLASS = {
  published: "bg-primary/10 text-primary",
  draft: "bg-warning/10 text-warning-fg",
  paused: "bg-primary/5 text-primary/80 ring-1 ring-primary/20",
  archived: "bg-bg-light text-muted/70 ring-1 ring-border",
  pending_review: "bg-warning/15 text-warning-fg ring-1 ring-warning/40",
} as const;

export function listingStatusLabel(status: ListingStatus | undefined, noun: "room" | "property" = "room"): string {
  const s = status ?? "published";
  if (noun === "property") {
    switch (s) {
      case "draft":
        return "Borrador";
      case "paused":
        return "Pausada";
      case "archived":
        return "Archivada";
      case "pending_review":
        return "En revisión";
      default:
        return "Publicada";
    }
  }
  switch (s) {
    case "draft":
      return "Borrador";
    case "paused":
      return "Pausado";
    case "archived":
      return "Archivado";
    case "pending_review":
      return "En revisión";
    default:
      return "Publicado";
  }
}

type Props = {
  status: ListingStatus | undefined;
  noun?: "room" | "property";
  className?: string;
};

/** Semantic status pill for publisher hub rows and property cards. */
export function ListingStatusBadge({ status, noun = "room", className = "" }: Props) {
  const s = status ?? "published";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[s]} ${className}`.trim()}
    >
      {listingStatusLabel(s, noun)}
    </span>
  );
}
