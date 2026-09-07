import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppConfirmDialog, replaceActiveSavedSearchNotifyMessage } from "@/components/AppConfirmDialog";
import { PropertyMap } from "@/components/map/PropertyMap";
import { SearchMobileResultsPanel } from "@/components/search/SearchMobileResultsPanel";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useFeedbackModal } from "@/contexts/FeedbackModalContext";
import { authMe, authUpdateMe, type AuthMe } from "@/lib/authApi";
import { collapseSearchListings } from "@/lib/collapseSearchListings";
import { interleaveHiddenPricingListingsStable } from "@/lib/listingPricing";
import { describeActiveSearchFilterChips } from "@/lib/savedSearchDraftLabel";
import {
  enableSavedSearchNotify,
  fetchSavedSearches,
} from "@/lib/savedSearchesApi";
import { searchReturnFromLocation } from "@/lib/searchReturn";
import {
  fetchSharedSearchView,
  subscribeSharedSearch,
  type SharedSearchPublicView,
} from "@/lib/sharedSearchesApi";
import type { PropertyListing } from "@/types/listing";

export function SharedSearchPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
  const { openFeedback, flashMapFab } = useFeedbackModal();
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [view, setView] = useState<SharedSearchPublicView | null>(null);
  const [viewErr, setViewErr] = useState<string | null>(null);
  const [exact, setExact] = useState<PropertyListing[]>([]);
  const [similar, setSimilar] = useState<PropertyListing[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [needEmail, setNeedEmail] = useState(false);
  const [replaceNotifyLabel, setReplaceNotifyLabel] = useState<string | null>(null);
  const pendingNotifyRef = useRef(false);

  useEffect(() => {
    const load = () => void authMe().then(setMe).catch(() => setMe(null));
    load();
    window.addEventListener("bestie:me-changed", load);
    return () => window.removeEventListener("bestie:me-changed", load);
  }, []);

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();
    setViewErr(null);
    void fetchSharedSearchView(slug, ac.signal)
      .then((next) => {
        setView(next);
        setExact(next.exact);
        setSimilar(next.similar);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setViewErr("No encontramos esta búsqueda.");
      });
    return () => ac.abort();
  }, [slug, me?.id]);

  const searchReturn = useMemo(
    () => searchReturnFromLocation(`/busquedas/${slug ?? ""}`, ""),
    [slug],
  );

  const briefChips = useMemo(() => {
    if (!view) return [];
    return describeActiveSearchFilterChips(view.filters, {
      cityLabel: view.location.cityLabel ?? view.cityLabel,
      neighborhoods: view.location.neighborhoods,
    });
  }, [view]);

  const unmapped = useMemo(
    () => view?.insights.filter((i) => !i.mapped).map((i) => i.text) ?? [],
    [view],
  );

  const exactList = useMemo(
    () => interleaveHiddenPricingListingsStable(collapseSearchListings(exact)),
    [exact],
  );
  const similarList = useMemo(() => {
    const exactIds = new Set(exactList.map((l) => l.id));
    return interleaveHiddenPricingListingsStable(
      collapseSearchListings(similar.filter((l) => !exactIds.has(l.id))),
    );
  }, [similar, exactList]);
  const mapListings = useMemo(() => [...exactList, ...similarList], [exactList, similarList]);
  const sections = useMemo(
    () => [
      { id: "exact", title: "En zona", listings: exactList },
      { id: "similar", title: "Cerca", listings: similarList },
    ],
    [exactList, similarList],
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const applyViewFromSubscribe = (nextSlug: string | null) => {
    if (nextSlug && slug && nextSlug !== slug) {
      navigate(`/busquedas/${nextSlug}`, { replace: true });
      return;
    }
    void fetchSharedSearchView(slug ?? "").then((next) => {
      setView(next);
      setExact(next.exact);
      setSimilar(next.similar);
    });
  };

  const finishNotify = async () => {
    if (!slug || !view) return;
    setBusy(true);
    setErr(null);
    try {
      if (view.alreadySaved && view.savedSearchId) {
        await enableSavedSearchNotify(view.savedSearchId);
        applyViewFromSubscribe(null);
        showToast("Alertas activadas. Revisa tu correo.");
        return;
      }
      const result = await subscribeSharedSearch(slug, { enableNotify: true });
      applyViewFromSubscribe(result.redirectedSlug);
      showToast("Guardada con alertas por correo.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No se pudieron activar las alertas.");
    } finally {
      setBusy(false);
      pendingNotifyRef.current = false;
    }
  };

  const onGuardar = async () => {
    if (!slug) return;
    if (!me?.id) {
      openLogin(`/busquedas/${slug}`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await subscribeSharedSearch(slug, { enableNotify: false });
      applyViewFromSubscribe(result.redirectedSlug);
      showToast(result.subscribedNow ? "Guardada en Mis Búsquedas." : "Ya la tenías guardada.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar la búsqueda.");
    } finally {
      setBusy(false);
    }
  };

  const onAvisarme = async () => {
    if (!slug) return;
    if (!me?.id) {
      openLogin(`/busquedas/${slug}`);
      return;
    }
    if (!me.email?.trim()) {
      setNeedEmail(true);
      return;
    }
    try {
      const rows = await fetchSavedSearches();
      const other = rows.find((r) => r.emailNotifyEnabled && r.id !== view?.savedSearchId);
      if (other) {
        pendingNotifyRef.current = true;
        setReplaceNotifyLabel(other.label);
        return;
      }
    } catch {
      /* still try to enable */
    }
    await finishNotify();
  };

  const onConfirmEmail = async () => {
    const trimmed = emailDraft.trim().toLowerCase();
    if (!trimmed) {
      setErr("Ingresa un correo para activar las alertas.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await authUpdateMe({ email: trimmed });
      setMe((cur) => (cur ? { ...cur, email: trimmed } : cur));
      setNeedEmail(false);
      try {
        const rows = await fetchSavedSearches();
        const other = rows.find((r) => r.emailNotifyEnabled && r.id !== view?.savedSearchId);
        if (other) {
          pendingNotifyRef.current = true;
          setReplaceNotifyLabel(other.label);
          return;
        }
      } catch {
        /* still try to enable */
      }
      await finishNotify();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar el correo.");
    } finally {
      setBusy(false);
    }
  };

  if (viewErr) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-lg overflow-x-clip px-3 py-10 sm:px-6">
        <h1 className="min-w-0 break-words text-2xl font-bold text-primary">Búsqueda no encontrada</h1>
        <p className="mt-2 text-sm text-muted">{viewErr}</p>
        <Link
          to="/buscar/gdl"
          className="mt-6 inline-flex min-h-11 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Ir a buscar
        </Link>
      </div>
    );
  }

  const alreadySaved = Boolean(view?.alreadySaved);
  const alertsOn = Boolean(view?.emailNotifyEnabled);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip">
      <AppConfirmDialog
        open={replaceNotifyLabel != null}
        title="Cambiar alertas activas"
        message={replaceActiveSavedSearchNotifyMessage(replaceNotifyLabel ?? "")}
        confirmLabel="Sí, cambiar"
        busy={busy}
        onConfirm={() => {
          setReplaceNotifyLabel(null);
          void finishNotify();
        }}
        onCancel={() => {
          setReplaceNotifyLabel(null);
          pendingNotifyRef.current = false;
        }}
      />

      {toast ? (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/40 px-4" role="status">
          <div className="w-full min-w-0 max-w-sm rounded-2xl border border-border bg-surface p-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-body">{toast}</p>
            <p className="mt-2 text-sm text-muted">
              Puedes cambiarla en{" "}
              <Link to="/mis-busquedas" className="font-semibold text-primary underline-offset-2 hover:underline">
                Mis Búsquedas
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      <header className="z-[1200] shrink-0 border-b border-border bg-surface px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="min-w-0 break-words text-base font-semibold text-body">
                {view?.label ?? "Búsqueda"}
              </h1>
              {view?.zoneRule ? (
                <p className="mt-0.5 min-w-0 break-words text-xs text-muted">{view.zoneRule}</p>
              ) : null}
            </div>
            {alreadySaved ? (
              <span className="shrink-0 rounded-full border border-secondary/40 bg-secondary/10 px-2 py-1 text-[11px] font-semibold text-body">
                La tienes guardada
              </span>
            ) : null}
          </div>

          {briefChips.length ? (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {briefChips.slice(0, 8).map((chip) => (
                <span
                  key={chip}
                  className="inline-flex min-h-6 min-w-0 max-w-full items-center rounded-full border border-border bg-bg-light px-2 text-[11px] font-medium text-muted"
                >
                  <span className="min-w-0 truncate">{chip}</span>
                </span>
              ))}
            </div>
          ) : null}

          {unmapped.length ? (
            <p className="min-w-0 break-words text-[11px] text-muted">
              También pidió: {unmapped.join(" · ")}
            </p>
          ) : null}

          {err ? <p className="text-xs text-error">{err}</p> : null}

          {needEmail ? (
            <div className="flex min-w-0 gap-2">
              <input
                type="email"
                autoComplete="email"
                size={10}
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="Tu correo"
                className="min-h-11 w-0 min-w-0 flex-1 rounded-full border border-border bg-surface px-3 text-base text-body sm:text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void onConfirmEmail()}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
              >
                Listo
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 gap-2">
              {alertsOn ? (
                <Link
                  to="/mis-busquedas"
                  className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-semibold text-body"
                >
                  Alertas activas
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy || alreadySaved}
                    onClick={() => void onGuardar()}
                    className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-60"
                  >
                    {alreadySaved ? "Guardada" : busy ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onAvisarme()}
                    className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-60"
                  >
                    Avisarme
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col border-border lg:flex-[2] lg:border-r">
          <div ref={mapSectionRef} className="relative min-h-0 flex-1 lg:min-h-[calc(100dvh-11rem)]">
            <div className="absolute inset-0">
              <PropertyMap
                embed
                className="h-full"
                listings={mapListings}
                selectedId={selectedId}
                onSelect={setSelectedId}
                searchReturn={searchReturn}
                popupOverlayHostRef={mapSectionRef}
                defaultCenter={
                  view?.location ? [view.location.lat, view.location.lng] : [20.67439, -103.38739]
                }
                defaultZoom={view?.location.zoom ?? 13}
                locationPins={view?.location.neighborhoods ?? []}
                preferDefaultView
              />
            </div>
            <SearchMobileResultsPanel
              listings={mapListings}
              sections={sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchReturn={searchReturn}
              filterRailLabelsExpanded={false}
              countLabel={
                view
                  ? `${exactList.length} en zona${similarList.length ? ` · ${similarList.length} cerca` : ""}`
                  : "Cargando…"
              }
              onOpenFeedback={() => openFeedback({ source: "map" })}
              flashFeedbackFab={flashMapFab}
            />
          </div>
        </section>

        <aside className="hidden min-h-0 min-w-0 flex-col border-border bg-surface lg:flex lg:min-w-[300px] lg:flex-[1] lg:border-l">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="min-w-0 break-words text-base font-semibold text-body">
              {view?.label ?? "Búsqueda"}
            </h2>
            <p className="shrink-0 text-sm text-muted">
              {view ? `${exactList.length + similarList.length}` : "Cargando…"}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <SearchResultsList
              dense
              listings={mapListings}
              sections={sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchReturn={searchReturn}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
