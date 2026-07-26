import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Pencil, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { AppConfirmDialog, replaceActiveSavedSearchNotifyMessage } from "@/components/AppConfirmDialog";
import { CardActionGroup, CardOnOffToggle } from "@/components/myListings/listingCardChrome";
import { SavedSearchFiltersPicker } from "@/components/search/SavedSearchFiltersPicker";
import {
  buildSavedSearchUrl,
  deleteSavedSearch,
  enableSavedSearchNotify,
  fetchSavedSearches,
  updateSavedSearch,
  type SavedSearchDto,
} from "@/lib/savedSearchesApi";
import { authMe, type AuthMe } from "@/lib/authApi";
import { parseFilters, type SearchFilters } from "@/lib/searchFilters";
import {
  describeActiveSearchFilterChips,
  formatSavedSearchTimestamp,
} from "@/lib/savedSearchDraftLabel";
import {
  parseSearchLocation,
  routeCityCodeFromPath,
  type SearchLocationState,
} from "@/lib/searchLocation";
import {
  savedSearchesNavigationState,
  savedSearchesReturnFromLocation,
} from "@/lib/savedSearchesReturn";

const CHIP_MAX = 6;
const CARD_TONE = "property" as const;

/**
 * Only one search can hold the email alert, so the forest edge is reserved for it.
 * The rest stay slate to keep the active one scannable in a stack.
 */
function searchCardShellClass(alertsOn: boolean): string {
  const base = "rounded-2xl border border-l-4 shadow-sm";
  return alertsOn
    ? `${base} border-primary/40 border-l-primary bg-primary/[0.04]`
    : `${base} border-border border-l-muted/35 bg-surface`;
}

type AlertTab = "all" | "with-alert" | "without-alert";

const ALERT_TABS: readonly { key: AlertTab; title: string }[] = [
  { key: "all", title: "Todas" },
  { key: "with-alert", title: "Con alerta" },
  { key: "without-alert", title: "Sin alerta" },
];

type ParsedSearch = {
  filters: SearchFilters;
  location: SearchLocationState;
  pathname: string;
};

/** Row + its parsed filters/chips/city/haystack computed once (see `rowViews` useMemo). */
type RowView = {
  row: SavedSearchDto;
  parsed: ParsedSearch | null;
  chipLabels: string[];
  cityLabel: string;
  haystack: string;
};

/** Alerts-on card first; otherwise keep API order (updated_at DESC). */
function pinAlertEnabledFirst(views: RowView[]): RowView[] {
  return [...views].sort(
    (a, b) => Number(b.row.emailNotifyEnabled) - Number(a.row.emailNotifyEnabled),
  );
}

function parseRowSearch(row: SavedSearchDto): ParsedSearch | null {
  try {
    const url = new URL(row.searchUrl, window.location.origin);
    const location = parseSearchLocation(url.searchParams, routeCityCodeFromPath(url.pathname));
    const filters = parseFilters(url.searchParams);
    return { filters, location, pathname: url.pathname };
  } catch {
    return null;
  }
}

function buildRowView(row: SavedSearchDto): RowView {
  const parsed = parseRowSearch(row);
  const chipLabels = parsed
    ? describeActiveSearchFilterChips(parsed.filters, parsed.location)
    : [];
  const cityLabel = parsed?.location.cityLabel?.trim() ?? "";
  const haystack = [row.label, cityLabel, ...chipLabels].join(" ").toLowerCase();
  return { row, parsed, chipLabels, cityLabel, haystack };
}

function FilterChips({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, CHIP_MAX);
  const overflow = labels.length - visible.length;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {visible.map((label, i) => (
        <li
          key={`${i}-${label}`}
          className="rounded-full border border-border bg-bg-light px-2.5 py-0.5 text-xs text-body"
        >
          {label}
        </li>
      ))}
      {overflow > 0 ? (
        <li className="rounded-full border border-border bg-bg-light px-2.5 py-0.5 text-xs text-muted">
          +{overflow}
        </li>
      ) : null}
    </ul>
  );
}

function SearchesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando búsquedas">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="min-h-[9.5rem] animate-pulse rounded-2xl border border-border bg-surface"
        />
      ))}
    </div>
  );
}

function RenameSearchDialog({
  open,
  initialLabel,
  busy,
  error,
  onCancel,
  onSave,
}: {
  open: boolean;
  initialLabel: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (label: string) => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(initialLabel);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setValue(initialLabel);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, initialLabel]);

  useEffect(() => {
    if (!open) return;

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !busy) {
        ev.preventDefault();
        onCancel();
        return;
      }
      if (ev.key !== "Tab" || !panelRef.current) return;
      const focusables = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialLabel.trim() && !busy;

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-primary">
          Renombrar búsqueda
        </h2>
        <label htmlFor={inputId} className="mt-4 block text-sm font-medium text-body">
          Nombre
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={value}
            disabled={busy}
            maxLength={80}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            onChange={(ev) => setValue(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && canSave) {
                ev.preventDefault();
                onSave(trimmed);
              }
            }}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-bg-light px-3 text-sm text-body outline-none ring-accent focus:ring-2 disabled:opacity-60"
          />
        </label>
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          Máximo 80 caracteres.
        </p>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-full border border-border py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(trimmed)}
            className="min-h-11 flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SavedSearchesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const savedSearchesNav = useMemo(
    () =>
      savedSearchesNavigationState(
        savedSearchesReturnFromLocation(location.pathname, location.search),
      ),
    [location.pathname, location.search],
  );
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [rows, setRows] = useState<SavedSearchDto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<AlertTab>("all");
  const [replaceNotifyPending, setReplaceNotifyPending] = useState<{
    otherLabel: string;
    row: SavedSearchDto;
  } | null>(null);
  const [replaceNotifyErr, setReplaceNotifyErr] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState<SavedSearchDto | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [renamePending, setRenamePending] = useState<SavedSearchDto | null>(null);
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<SavedSearchDto | null>(null);
  const [editFilters, setEditFilters] = useState<SearchFilters | null>(null);
  const [editLocation, setEditLocation] = useState<SearchLocationState | null>(null);
  const [editPathname, setEditPathname] = useState<string>("/buscar");
  const [editOriginal, setEditOriginal] = useState<string>("");
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const rowViews = useMemo(() => rows?.map(buildRowView) ?? [], [rows]);

  const load = useCallback(async () => {
    setErr(null);
    const isRefresh = rowsRef.current !== null;
    if (isRefresh) setRefreshing(true);
    try {
      setRows(await fetchSavedSearches());
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
      if (rowsRef.current === null) setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void authMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (me?.id) void load();
  }, [me, load]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 8000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const onToggleNotify = async (row: SavedSearchDto, enable: boolean) => {
    if (!enable) {
      setBusyId(row.id);
      setErr(null);
      try {
        await updateSavedSearch(row.id, { emailNotifyEnabled: false });
        setFlash("Alertas desactivadas.");
        await load();
      } catch (x) {
        setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (!me?.email) {
      setErr("Agrega un correo en tu perfil para activar alertas por correo.");
      return;
    }

    const other = rows?.find((r) => r.emailNotifyEnabled && r.id !== row.id);
    if (other) {
      setReplaceNotifyErr(null);
      setReplaceNotifyPending({ otherLabel: other.label, row });
      return;
    }

    await enableNotifyForRow(row);
  };

  const enableNotifyForRow = async (
    row: SavedSearchDto,
    onError: (message: string) => void = setErr,
  ): Promise<boolean> => {
    setBusyId(row.id);
    setErr(null);
    try {
      const result = await enableSavedSearchNotify(row.id);
      setFlash(
        result.emailSent === false
          ? "Alertas activadas. El correo no pudo enviarse (revisa la configuración SMTP del servidor)."
          : "Alertas activadas. Revisa tu correo con los anuncios actuales.",
      );
      await load();
      return true;
    } catch (x) {
      onError(x instanceof Error ? x.message : "No se pudo completar la acción.");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmReplaceNotify = async () => {
    const pending = replaceNotifyPending;
    if (!pending) return;
    setReplaceNotifyErr(null);
    const enabled = await enableNotifyForRow(pending.row, setReplaceNotifyErr);
    if (enabled) setReplaceNotifyPending(null);
  };

  const onSaveRename = async (label: string) => {
    const row = renamePending;
    if (!row) return;
    setBusyId(row.id);
    setRenameErr(null);
    try {
      await updateSavedSearch(row.id, { label });
      setRenamePending(null);
      setFlash("Nombre actualizado.");
      await load();
    } catch (x) {
      setRenameErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusyId(null);
    }
  };

  const onEditFilters = (row: SavedSearchDto) => {
    setErr(null);
    setFlash(null);
    const parsed = parseRowSearch(row);
    if (!parsed) {
      setErr("No se pudieron cargar los filtros de esta búsqueda.");
      return;
    }
    setEditRow(row);
    setEditFilters(parsed.filters);
    setEditLocation(parsed.location);
    setEditPathname(parsed.pathname);
    setEditOriginal(JSON.stringify(parsed.filters));
  };

  const closeEditor = async () => {
    const row = editRow;
    const flt = editFilters;
    const loc = editLocation;
    const pathname = editPathname;
    const unchanged = flt != null && JSON.stringify(flt) === editOriginal;
    setEditRow(null);
    setEditFilters(null);
    setEditLocation(null);
    if (!row || !flt || !loc || unchanged) return;

    setBusyId(row.id);
    setErr(null);
    try {
      const searchUrl = buildSavedSearchUrl(pathname, flt, loc);
      await updateSavedSearch(row.id, {
        filters: flt,
        location: {
          cityCode: loc.cityCode,
          cityLabel: loc.cityLabel,
          neighborhoods: loc.neighborhoods,
          lat: loc.lat,
          lng: loc.lng,
          zoom: loc.zoom,
        },
        searchUrl,
      });
      setFlash("Filtros de la búsqueda actualizados.");
      await load();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmDelete = async () => {
    const row = deletePending;
    if (!row) return;
    setBusyId(row.id);
    setDeleteErr(null);
    try {
      await deleteSavedSearch(row.id);
      setDeletePending(null);
      setFlash("Búsqueda eliminada.");
      await load();
    } catch (x) {
      setDeleteErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusyId(null);
    }
  };

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <SearchesSkeleton />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Mis Búsquedas</h1>
        <div className="mt-8 rounded-2xl border border-border bg-surface px-4 py-10 text-center shadow-sm">
          <Bookmark className="mx-auto size-8 text-muted" strokeWidth={1.5} aria-hidden />
          <p className="mt-3 text-sm font-medium text-body">Inicia sesión para ver tus búsquedas.</p>
          <p className="mt-1 text-sm text-muted">Guarda filtros del mapa y actívalos cuando quieras.</p>
          <Link
            to="/entrar"
            state={savedSearchesNav}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.99]"
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const queryFiltered = pinAlertEnabledFirst(
    q ? rowViews.filter((rv) => rv.haystack.includes(q)) : rowViews,
  );
  const tabCounts = {
    all: queryFiltered.length,
    "with-alert": queryFiltered.filter((rv) => rv.row.emailNotifyEnabled).length,
    "without-alert": queryFiltered.filter((rv) => !rv.row.emailNotifyEnabled).length,
  };
  const visibleRows =
    activeTab === "all"
      ? queryFiltered
      : activeTab === "with-alert"
        ? queryFiltered.filter((rv) => rv.row.emailNotifyEnabled)
        : queryFiltered.filter((rv) => !rv.row.emailNotifyEnabled);

  const alertCount = rows?.filter((r) => r.emailNotifyEnabled).length ?? 0;
  const summaryLine =
    rows && rows.length > 0
      ? `${rows.length} búsqueda${rows.length === 1 ? "" : "s"} · ${alertCount} con alerta${alertCount === 1 ? "" : "s"}`
      : null;

  const activeTabMeta = ALERT_TABS.find((t) => t.key === activeTab)!;
  const otherTabWithItems = ALERT_TABS.find(
    (t) => t.key !== activeTab && tabCounts[t.key] > 0,
  );
  const otherTabCount = otherTabWithItems ? tabCounts[otherTabWithItems.key] : 0;

  return (
    <>
      <AppConfirmDialog
        open={replaceNotifyPending != null}
        title="Cambiar alertas activas"
        message={
          replaceNotifyPending
            ? replaceActiveSavedSearchNotifyMessage(
                replaceNotifyPending.otherLabel,
                replaceNotifyPending.row.label,
              )
            : ""
        }
        confirmLabel="Sí, cambiar"
        error={replaceNotifyErr}
        busy={replaceNotifyPending != null && busyId === replaceNotifyPending.row.id}
        onConfirm={() => void onConfirmReplaceNotify()}
        onCancel={() => {
          setReplaceNotifyPending(null);
          setReplaceNotifyErr(null);
        }}
      />
      <AppConfirmDialog
        open={deletePending != null}
        title={deletePending ? `¿Eliminar «${deletePending.label}»?` : "¿Eliminar?"}
        message="Esta acción no se puede deshacer. La búsqueda dejará de aparecer en tu lista."
        confirmLabel="Eliminar"
        intent="danger"
        error={deleteErr}
        busy={deletePending != null && busyId === deletePending.id}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => {
          setDeletePending(null);
          setDeleteErr(null);
        }}
      />
      <RenameSearchDialog
        open={renamePending != null}
        initialLabel={renamePending?.label ?? ""}
        busy={renamePending != null && busyId === renamePending.id}
        error={renameErr}
        onCancel={() => {
          setRenamePending(null);
          setRenameErr(null);
        }}
        onSave={(label) => void onSaveRename(label)}
      />
      {editRow && editFilters && editLocation ? (
        <SavedSearchFiltersPicker
          open
          onClose={() => void closeEditor()}
          filters={editFilters}
          onFiltersChange={setEditFilters}
          searchLocation={editLocation}
        />
      ) : null}

      {flash ? (
        <div
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-[1800] mx-auto flex max-w-4xl items-start gap-3 rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-body shadow-lg sm:left-6 sm:right-6 lg:bottom-auto lg:left-auto lg:right-6 lg:top-[4.5rem] lg:mx-0 lg:w-full lg:max-w-sm"
          role="status"
        >
          <p className="min-w-0 flex-1">{flash}</p>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setFlash(null)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-body"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-4 py-8 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-10">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Mis Búsquedas</h1>
            <Link
              to="/buscar"
              state={savedSearchesNav}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-primary bg-surface px-3.5 text-xs font-semibold text-body transition hover:bg-surface-elevated"
            >
              Buscar
            </Link>
          </div>
          {summaryLine ? (
            <p className="mt-2 text-sm font-medium text-body">{summaryLine}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Búsquedas guardadas desde el mapa. Puedes activar alertas por correo en una a la vez.
            </p>
          )}
        </div>

        {err ? (
          <p
            className="mt-4 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
            role="alert"
          >
            {err}
            {" "}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex min-h-11 items-center px-2 font-semibold underline underline-offset-2"
            >
              Reintentar
            </button>
          </p>
        ) : null}

        <div className="mt-8 space-y-4" aria-busy={refreshing || undefined}>
          {refreshing ? (
            <p className="sr-only" aria-live="polite">
              Actualizando búsquedas…
            </p>
          ) : null}

          {rows === null ? (
            <SearchesSkeleton />
          ) : rows.length === 0 && err ? null : rows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface px-4 py-10 text-center shadow-sm">
              <Bookmark className="mx-auto size-8 text-muted" strokeWidth={1.5} aria-hidden />
              <p className="mt-3 text-sm font-medium text-body">Aún no tienes búsquedas guardadas.</p>
              <p className="mt-1 text-sm text-muted">
                Usa Guardar búsqueda en el mapa para seguir filtros y alertas.
              </p>
              <Link
                to="/buscar"
                state={savedSearchesNav}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.99]"
              >
                Buscar cuarto
              </Link>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar en mis búsquedas"
                  placeholder="Buscar por nombre, filtro o ciudad"
                  className="min-h-12 w-full rounded-full border border-border bg-surface pl-11 pr-11 text-sm text-body placeholder:text-muted focus-visible:border-accent [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setQuery("")}
                    className="absolute right-1.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-body"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {searching ? (
                <p className="mt-2 text-sm font-medium text-body" role="status" aria-live="polite">
                  {tabCounts.all === 0
                    ? "Sin resultados"
                    : `${tabCounts.all} resultado${tabCounts.all === 1 ? "" : "s"}`}
                </p>
              ) : null}

              <div
                role="tablist"
                aria-label="Filtrar por alerta"
                className="-mb-px mt-6 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-border pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onKeyDown={(ev) => {
                  if (
                    ev.key !== "ArrowLeft" &&
                    ev.key !== "ArrowRight" &&
                    ev.key !== "Home" &&
                    ev.key !== "End"
                  )
                    return;
                  const idx = ALERT_TABS.findIndex((t) => t.key === activeTab);
                  if (idx < 0) return;
                  const next =
                    ev.key === "Home"
                      ? ALERT_TABS[0]!
                      : ev.key === "End"
                        ? ALERT_TABS[ALERT_TABS.length - 1]!
                        : ev.key === "ArrowRight"
                          ? ALERT_TABS[(idx + 1) % ALERT_TABS.length]!
                          : ALERT_TABS[(idx - 1 + ALERT_TABS.length) % ALERT_TABS.length]!;
                  ev.preventDefault();
                  setActiveTab(next.key);
                  window.requestAnimationFrame(() => {
                    document.getElementById(`mis-busquedas-tab-${next.key}`)?.focus();
                  });
                }}
              >
                {ALERT_TABS.map((tab) => {
                  const active = activeTab === tab.key;
                  const count = tabCounts[tab.key];
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      tabIndex={active ? 0 : -1}
                      id={`mis-busquedas-tab-${tab.key}`}
                      aria-controls={`mis-busquedas-panel-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-xs font-semibold transition sm:gap-2 sm:px-4 sm:text-sm ${
                        active
                          ? "border-primary text-primary"
                          : "border-transparent text-muted hover:border-border hover:text-body"
                      }`}
                    >
                      {tab.title}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 sm:px-2 sm:text-xs ${
                          active
                            ? "bg-primary/10 text-primary ring-primary/20"
                            : "bg-bg-light text-muted ring-border"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                role="tabpanel"
                id={`mis-busquedas-panel-${activeTab}`}
                aria-labelledby={`mis-busquedas-tab-${activeTab}`}
                className="space-y-4 pt-4"
              >
                {visibleRows.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center shadow-sm">
                    <p className="text-sm font-medium text-body">
                      {searching
                        ? otherTabWithItems
                          ? `Sin coincidencias en ${activeTabMeta.title}.`
                          : `Ninguna búsqueda coincide con “${query.trim()}”.`
                        : activeTab === "with-alert"
                          ? "No tienes búsquedas con alerta."
                          : activeTab === "without-alert"
                            ? "No tienes búsquedas sin alerta."
                            : "No hay búsquedas en esta pestaña."}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {searching
                        ? otherTabWithItems
                          ? `Hay ${otherTabCount} coincidencia${otherTabCount === 1 ? "" : "s"} en ${otherTabWithItems.title}.`
                          : "Prueba con el nombre, una colonia o la ciudad."
                        : otherTabWithItems
                          ? `Hay ${otherTabCount} búsqueda${otherTabCount === 1 ? "" : "s"} en ${otherTabWithItems.title}.`
                          : "Guarda una búsqueda desde el mapa para verla aquí."}
                    </p>
                    {otherTabWithItems ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab(otherTabWithItems.key)}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
                      >
                        Ver {otherTabWithItems.title}
                      </button>
                    ) : searching ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
                      >
                        Limpiar búsqueda
                      </button>
                    ) : (
                      <Link
                        to="/buscar"
                        state={savedSearchesNav}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.99]"
                      >
                        Buscar cuarto
                      </Link>
                    )}
                  </div>
                ) : (
                  visibleRows.map(({ row, parsed, chipLabels, cityLabel }) => {
                    const cityCode = parsed?.location.cityCode ?? "gdl";
                    const timestamp = formatSavedSearchTimestamp(row.updatedAt, cityCode);
                    const matchLabel =
                      row.matchCount != null
                        ? `${row.matchCount} anuncio${row.matchCount === 1 ? "" : "s"}`
                        : null;
                    const rowBusy = busyId === row.id;
                    const noEmailHintId = `mis-busquedas-no-email-${row.id}`;

                    return (
                      <article
                        key={row.id}
                        className={`${searchCardShellClass(row.emailNotifyEnabled)} p-4`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start gap-1">
                              <h2 className="min-w-0 text-base font-semibold leading-snug text-body">
                                {row.label}
                              </h2>
                              <button
                                type="button"
                                disabled={rowBusy}
                                aria-label="Renombrar búsqueda"
                                title="Renombrar"
                                onClick={() => {
                                  setErr(null);
                                  setRenameErr(null);
                                  setRenamePending(row);
                                }}
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-primary disabled:opacity-50"
                              >
                                <Pencil className="size-3.5" aria-hidden strokeWidth={2.2} />
                              </button>
                            </div>
                            <FilterChips labels={chipLabels} />
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-xs text-muted">
                                Actualizada {timestamp}
                                {cityLabel ? ` · ${cityLabel}` : ""}
                              </p>
                              {matchLabel ? (
                                <span className="inline-flex min-h-6 items-center rounded-full border border-border bg-bg-light px-2 text-[11px] font-medium text-muted">
                                  {matchLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex w-[5.25rem] flex-col items-center gap-1">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                Alertas
                              </span>
                              <CardOnOffToggle
                                active={row.emailNotifyEnabled}
                                tone={CARD_TONE}
                                disabled={!me.email}
                                busy={rowBusy}
                                onLabel="Desactivar alertas por correo"
                                offLabel="Activar alertas por correo"
                                describedById={!me.email ? noEmailHintId : undefined}
                                onChange={(next) => void onToggleNotify(row, next)}
                              />
                            </div>
                            {!me.email ? (
                              <p
                                id={noEmailHintId}
                                className="max-w-[10rem] text-right text-[11px] leading-snug text-muted"
                              >
                                <Link
                                  to="/perfil/editar"
                                  className="font-semibold text-primary underline"
                                >
                                  Agrega un correo
                                </Link>
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-row flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(row.searchUrl, { state: savedSearchesNav })}
                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.99] sm:flex-none"
                          >
                            <Search className="size-4" aria-hidden strokeWidth={2.2} />
                            Abrir
                          </button>
                          <CardActionGroup
                            tone={CARD_TONE}
                            aria-label="Acciones de la búsqueda"
                            actions={[
                              {
                                key: "edit",
                                label: "Filtros",
                                icon: (
                                  <SlidersHorizontal
                                    className="size-3.5"
                                    aria-hidden
                                    strokeWidth={2.2}
                                  />
                                ),
                                disabled: rowBusy,
                                onClick: () => onEditFilters(row),
                              },
                              {
                                key: "delete",
                                label: "Eliminar",
                                icon: (
                                  <Trash2 className="size-3.5" aria-hidden strokeWidth={2.2} />
                                ),
                                disabled: rowBusy,
                                onClick: () => {
                                  setErr(null);
                                  setDeleteErr(null);
                                  setDeletePending(row);
                                },
                              },
                            ]}
                          />
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
