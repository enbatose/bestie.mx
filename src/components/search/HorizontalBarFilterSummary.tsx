import { horizontalBarFilterRows } from "@/lib/horizontalBarFilters";
import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
};

export function HorizontalBarFilterSummary({ filters }: Props) {
  const rows = horizontalBarFilterRows(filters);

  return (
    <ul className="mt-2 space-y-2">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <li
            key={row.id}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
              row.active
                ? "border-primary/20 bg-surface font-medium text-body shadow-sm"
                : "border-transparent bg-transparent font-normal text-muted"
            }`}
          >
            <Icon
              className={`size-4 shrink-0 ${row.active ? "text-primary" : "text-muted"}`}
              aria-hidden
              strokeWidth={2.1}
            />
            <span className="shrink-0 font-semibold text-primary/90">{row.label}</span>
            <span className="min-w-0 truncate">{row.value}</span>
          </li>
        );
      })}
    </ul>
  );
}
