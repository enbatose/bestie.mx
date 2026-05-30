import { apiAbsoluteUrl } from "@/lib/mediaUrl";

type Props = {
  displayName?: string | null;
  profilePictureUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-20 w-20 text-xl",
} as const;

export function userInitials(displayName?: string | null): string {
  const parts = (displayName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function GenericUserIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

export function UserAvatar({ displayName, profilePictureUrl, size = "md", className = "" }: Props) {
  const dim = sizeClass[size];
  const src = profilePictureUrl?.trim() ? apiAbsoluteUrl(profilePictureUrl) : null;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={[
          "shrink-0 rounded-full object-cover ring-1 ring-border",
          dim,
          className,
        ].join(" ")}
      />
    );
  }

  const initials = userInitials(displayName);
  if (initials !== "?") {
    return (
      <span
        aria-hidden
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ring-1 ring-border",
          dim,
          className,
        ].join(" ")}
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-elevated text-muted ring-1 ring-border",
        dim,
        className,
      ].join(" ")}
    >
      <GenericUserIcon className={size === "lg" ? "h-10 w-10" : size === "sm" ? "h-5 w-5" : "h-5 w-5"} />
    </span>
  );
}
