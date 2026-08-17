import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  titleMuted?: boolean;
  id?: string;
  className?: string;
};

export function ListingSection({
  title,
  subtitle,
  children,
  action,
  titleMuted = false,
  id,
  className = "",
}: Props) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 ${className}`.trim()}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className={titleMuted ? "text-sm font-semibold text-muted" : "text-sm font-semibold text-body"}
          >
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="max-w-[48%] shrink-0 sm:max-w-none">{action}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
