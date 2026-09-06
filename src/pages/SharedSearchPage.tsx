import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PropertyMap } from "@/components/map/PropertyMap";
import { SearchMobileResultsPanel } from "@/components/search/SearchMobileResultsPanel";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useFeedbackModal } from "@/contexts/FeedbackModalContext";
import { authMe, type AuthMe } from "@/lib/authApi";
import { collapseSearchListings } from "@/lib/collapseSearchListings";
import { interleaveHiddenPricingListingsStable } from "@/lib/listingPricing";
import { searchReturnFromLocation } from "@/lib/searchReturn";
import {
  fetchSharedSearchMeta,
  subscribeSharedSearch,
  type SharedSearchMeta,
} from "@/lib/sharedSearchesApi";
import type { PropertyListing } from "@/types/listing";

export function SharedSearchPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
  const { openFeedback, flashMapFab } = useFeedbackModal();
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [meta, setMeta] = useState<SharedSearchMeta | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [exact, setExact] = useState<PropertyListing[]>([]);
  const [similar, setSimilar] = useState<PropertyListing[]>([]);
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    neighborhoods: { name: string; lat: number; lng: number }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    subscribedRef.current = false;
  }, [slug]);

  useEffect(() => {
    const load = () => void authMe().then(setMe).catch(() => setMe(null));
    load();
    window.addEventListener("bestie:me-changed", load);
    return () => window.removeEventListener("bestie:me-changed", load);
  }, []);

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();
    void fetchSharedSearchMeta(slug, ac.signal)
      .then(setMeta)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setMetaErr("No encontramos esta búsqueda.");
      });
    return () => ac.abort();
  }, [slug]);

  useEffect(() => {
    if (me === null && slug) {
      openLogin(`/busquedas/${slug}`);
    }
  }, [me, slug, openLogin]);

  useEffect(() => {
    if (!me?.id || !slug || subscribedRef.current) return;
    subscribedRef.current = true;
    setBusy(true);
    setErr(null);
    void subscribeSharedSearch(slug)
      .then((result) => {
        if (result.redirectedSlug && result.redirectedSlug !== slug) {
          navigate(`/busquedas/${result.redirectedSlug}`, { replace: true });
        }
        setExact(result.listings.exact);
        setSimilar(result.listings.similar);
        setLocation(result.location);
        if (result.subscribedNow) {
          setToast(true);
          window.setTimeout(() => setToast(false), 2000);
        }
      })
      .catch((e: unknown) => {
        subscribedRef.current = false;
        setErr(e instanceof Error ? e.message : "No se pudo abrir la búsqueda.");
      })
      .finally(() => setBusy(false));
  }, [me?.id, slug, navigate]);

  const searchReturn = useMemo(
    () => searchReturnFromLocation(`/busquedas/${slug ?? ""}`, ""),
    [slug],
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
      { id: "exact", title: "Coincidencias exactas", listings: exactList },
      { id: "similar", title: "Similares", listings: similarList },
    ],
    [exactList, similarList],
  );

  if (metaErr) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Búsqueda no encontrada</h1>
        <p className="mt-2 text-sm text-muted">{metaErr}</p>
        <Link to="/buscar/gdl" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg">
          Ir a buscar
        </Link>
      </div>
    );
  }

  if (me === null) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Inicia sesión para ver los resultados</h1>
        <p className="mt-2 text-sm text-muted">
          {meta?.caption ?? "Esta búsqueda de Bestie muestra cuartos que coinciden con lo que pediste."}
        </p>
        <button
          type="button"
          onClick={() => openLogin(`/busquedas/${slug}`)}
          className="mt-6 inline-flex min-h-11 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Entrar o registrarte
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {toast ? (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/40 px-4" role="status">
          <div className="w-full min-w-0 max-w-sm rounded-2xl border border-border bg-surface p-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-body">Te suscribimos a esta búsqueda</p>
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

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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
                  location ? [location.lat, location.lng] : [20.67439, -103.38739]
                }
                defaultZoom={location?.zoom ?? 13}
                locationPins={location?.neighborhoods ?? []}
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
              countLabel={busy ? "Cargando…" : `${exactList.length + similarList.length}`}
              onOpenFeedback={() => openFeedback({ source: "map" })}
              flashFeedbackFab={flashMapFab}
            />
          </div>
        </section>

        <aside className="hidden min-h-0 min-w-0 flex-col border-border bg-surface lg:flex lg:min-w-[300px] lg:flex-[1] lg:border-l">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="min-w-0 break-words text-base font-semibold text-body">
              {meta?.label ?? "Búsqueda"}
            </h2>
            <p className="shrink-0 text-sm text-muted">
              {busy ? "Cargando…" : `${exactList.length + similarList.length}`}
            </p>
          </div>
          {err ? (
            <p className="border-b border-error/30 bg-error/5 px-4 py-2 text-xs text-error">{err}</p>
          ) : null}
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
