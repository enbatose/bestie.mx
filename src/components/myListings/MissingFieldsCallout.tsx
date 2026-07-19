type Props = {
  fields: string;
  className?: string;
};

/**
 * Warning callout listing incomplete draft fields before publish.
 * `fields` is a pre-joined Spanish label string (e.g. "Colonia · Ciudad").
 */
export function MissingFieldsCallout({ fields, className = "" }: Props) {
  const parts = fields
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div
      className={`rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-warning-fg ${className}`.trim()}
    >
      <p className="text-xs font-semibold">Completa antes de publicar</p>
      {parts.length > 1 ? (
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs">
          {parts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs font-medium">{fields}</p>
      )}
    </div>
  );
}
