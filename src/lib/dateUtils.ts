/** Today's date in `America/Mexico_City` as `YYYY-MM-DD`, e.g. for `<input type="date">` min/default values. */
export function isoDateTodayMexicoCity(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (y && m && day) return `${y}-${m}-${day}`;
  return date.toISOString().slice(0, 10);
}
