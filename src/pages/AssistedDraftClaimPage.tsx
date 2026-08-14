import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Edit2, Rocket } from "lucide-react";
import { useAppShellOutlet } from "@/layouts/appShellOutletContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  activateAssistedDraftClaim,
  fetchAssistedDraftClaim,
  publishAssistedDraftClaim,
  type AssistedDraftClaimInfo,
} from "@/lib/assistedDraftApi";
import { fetchPropertyWithRooms } from "@/lib/listingsApi";
import { draftFromPropertyBundle } from "@/pages/PublishWizardPage";
import { publishWizardLastStepIndex } from "@/lib/publishWizard/previewSession";

const LABEL_KIND: Record<string, string> = {
  house: "Casa", apartment: "Departamento", loft: "Loft",
};
const LABEL_LODGING: Record<string, string> = {
  private_room: "Recámara privada", shared_room: "Recámara compartida",
};
const LABEL_GENDER: Record<string, string> = {
  any: "Hombre o Mujer", female: "Solo mujeres", male: "Solo hombres",
};

function formatMxn(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });
}

type PageState =
  | { phase: "loading" }
  | { phase: "loaded"; info: AssistedDraftClaimInfo }
  | { phase: "error"; message: string }
  | { phase: "published"; propertyId: string; firstRoomId?: string }
  | { phase: "already_claimed" };

function MissingFieldBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs text-warning-fg">
      <AlertCircle size={11} />
      {label}
    </span>
  );
}

export function AssistedDraftClaimPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPublish = searchParams.get("publish") === "1";
  const { me } = useAppShellOutlet();
  const { openAuthModal } = useAuthModal();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState(false);
  const loadedRef = useRef(false);
  const autoPublishTriggeredRef = useRef(false);

  useEffect(() => {
    if (!token || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const info = await fetchAssistedDraftClaim(token);
        if (info.isClaimed) {
          setState({ phase: "already_claimed" });
          return;
        }
        setState({ phase: "loaded", info });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "not_found";
        setState({
          phase: "error",
          message:
            msg === "expired"
              ? "Este enlace ya no está disponible."
              : msg === "not_found"
                ? "No encontramos este borrador."
                : "No pudimos cargar el borrador.",
        });
      }
    })();
  }, [token]);

  const handleEdit = useCallback(async () => {
    if (!token || state.phase !== "loaded") return;
    setEditing(true);
    try {
      if (!me?.isAdmin) {
        await activateAssistedDraftClaim(token);
      }
      const { propertyId } = state.info;
      const bundle = await fetchPropertyWithRooms(propertyId);
      if (!bundle) {
        navigate(`/publicar?edit=${encodeURIComponent(propertyId)}`);
        return;
      }
      const { draft, serverSync } = draftFromPropertyBundle(bundle);
      navigate("/publicar", {
        state: {
          resumeDraft: draft,
          resumeServerSync: serverSync,
          resumeStep: publishWizardLastStepIndex(draft.postMode),
        },
      });
    } catch {
      navigate(`/publicar?edit=${encodeURIComponent(state.info.propertyId)}`);
    } finally {
      setEditing(false);
    }
  }, [token, state, me, navigate]);

  const doPublish = useCallback(async () => {
    if (!token) return;
    setPublishing(true);
    try {
      const result = await publishAssistedDraftClaim(token);
      setState({ phase: "published", propertyId: result.propertyId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "publish_error";
      if (msg === "already_claimed_by_other") {
        setState({ phase: "already_claimed" });
      } else {
        alert("No pudimos publicar el anuncio. Intenta de nuevo.");
      }
    } finally {
      setPublishing(false);
    }
  }, [token]);

  // Auto-publish when returning from auth flow with ?publish=1
  useEffect(() => {
    if (!autoPublish || !me?.id || autoPublishTriggeredRef.current) return;
    if (state.phase !== "loaded") return;
    autoPublishTriggeredRef.current = true;
    void doPublish();
  }, [autoPublish, me?.id, state.phase, doPublish]);

  const handlePublish = useCallback(() => {
    if (me?.id) {
      void doPublish();
      return;
    }
    const returnTo = `/borrador/${token ?? ""}?publish=1`;
    openAuthModal(returnTo);
  }, [me, openAuthModal, doPublish, token]);

  if (state.phase === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm text-muted">Cargando borrador…</p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-error/30 bg-error/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 text-error" size={32} />
          <p className="font-semibold text-body">{state.message}</p>
          <p className="mt-1 text-sm text-muted">Si crees que es un error, contacta a Bestie.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "already_claimed") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-secondary" size={32} />
          <p className="font-semibold text-body">Este borrador ya fue publicado.</p>
          <p className="mt-1 text-sm text-muted">Busca tu anuncio en Mis Anuncios.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "published") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 text-secondary" size={40} />
          <p className="text-xl font-bold text-body">¡Tu anuncio está publicado!</p>
          <p className="mt-2 text-sm text-muted">
            Aparecerá en los resultados de búsqueda de Bestie para que roomies lo encuentren.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={`/mis-anuncios`}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110"
            >
              Ver mis anuncios
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { info } = state;
  const room = info.rooms[0];
  const prop = info.property;

  const missingFields: string[] = [];
  if (!room?.rentMxn) missingFields.push("Precio de renta");
  if (!prop.neighborhood?.trim()) missingFields.push("Colonia");
  if (!prop.title?.trim()) missingFields.push("Título del anuncio");
  if (!room?.summary?.trim() || room.summary.trim().length < 10) missingFields.push("Descripción");
  if (!room?.availableFrom) missingFields.push("Fecha de disponibilidad");
  if (prop.isApproximateLocation && !prop.lat) missingFields.push("Ubicación");
  if (!prop.lat || (Math.abs(prop.lat - 20.675138) < 0.001 && Math.abs(prop.lng - (-103.347345)) < 0.001)) {
    if (!missingFields.includes("Ubicación")) missingFields.push("Ubicación (confirmar)");
  }

  const allPhotos = [...(prop.imageUrls ?? []), ...(room?.imageUrls ?? [])];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Context banner */}
      <div className="mb-6 rounded-2xl border border-secondary/40 bg-secondary/5 px-4 py-3">
        <p className="text-sm font-semibold text-body">Borrador creado por Bestie</p>
        <p className="mt-0.5 text-xs text-muted">
          Alguien de Bestie creó este borrador con información que encontramos publicada en grupos de Facebook asociados.
          Revisa los datos, edita lo que necesites y publícalo cuando estés listo. El anuncio quedará bajo tu cuenta.
        </p>
      </div>

      {/* Missing fields callout */}
      {missingFields.length > 0 && (
        <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-warning-fg">
            Campos que requieren tu atención antes de publicar:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map((f) => (
              <MissingFieldBadge key={f} label={f} />
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {allPhotos.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-2xl">
          <div className="flex gap-1 overflow-x-auto">
            {allPhotos.slice(0, 5).map((url, i) => (
              <div key={i} className="relative h-48 w-64 flex-shrink-0 overflow-hidden rounded-xl">
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listing card */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        {/* Title + price */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-body">
            {prop.title || <span className="text-muted italic">Sin título</span>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {prop.neighborhood || <span className="italic">Sin colonia</span>}
            {prop.neighborhood && prop.city ? `, ${prop.city}` : prop.city}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          {room?.rentMxn ? (
            <>
              <span className="text-2xl font-bold text-body">{formatMxn(room.rentMxn)}</span>
              <span className="text-sm text-muted">/mes</span>
              {room.depositMxn ? (
                <span className="text-xs text-muted">· Depósito {formatMxn(room.depositMxn)}</span>
              ) : null}
            </>
          ) : (
            <span className="text-lg font-semibold text-warning-fg">Precio no disponible</span>
          )}
        </div>

        {/* Key attributes */}
        <div className="flex flex-wrap gap-2 text-xs">
          {prop.propertyKind && (
            <span className="rounded-full border border-border bg-bg-light px-2.5 py-1">
              {LABEL_KIND[prop.propertyKind] ?? prop.propertyKind}
            </span>
          )}
          {room?.lodgingType && (
            <span className="rounded-full border border-border bg-bg-light px-2.5 py-1">
              {LABEL_LODGING[room.lodgingType] ?? room.lodgingType}
            </span>
          )}
          {room?.roommateGenderPref && (
            <span className="rounded-full border border-border bg-bg-light px-2.5 py-1">
              {LABEL_GENDER[room.roommateGenderPref] ?? room.roommateGenderPref}
            </span>
          )}
          {room?.ageMin && room.ageMax && (
            <span className="rounded-full border border-border bg-bg-light px-2.5 py-1">
              {room.ageMin}–{room.ageMax} años
            </span>
          )}
          {room?.availableFrom && (
            <span className="rounded-full border border-border bg-bg-light px-2.5 py-1">
              Disponible {room.availableFrom}
            </span>
          )}
          {room?.minimalStayMonths && (
            <span className="rounded-full border border-border bg-bg-light px-2.5 py-1">
              Mín. {room.minimalStayMonths} {room.minimalStayMonths === 1 ? "mes" : "meses"}
            </span>
          )}
        </div>

        {/* Description */}
        {room?.summary && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Descripción</p>
            <p className="text-sm leading-relaxed text-body whitespace-pre-wrap">{room.summary}</p>
          </div>
        )}

        {/* Amenity tags */}
        {room?.tags && room.tags.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Características</p>
            <div className="flex flex-wrap gap-1.5">
              {room.tags.map((t) => (
                <span key={t} className="rounded-full border border-border bg-bg-light px-2.5 py-1 text-xs text-body">
                  {t.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Location indicator */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Ubicación</p>
          {prop.isApproximateLocation ? (
            <p className="text-xs text-muted">
              Ubicación aproximada (radio {prop.approximateRadiusMeters ?? 200}m) ·{" "}
              {prop.neighborhood || prop.city}
            </p>
          ) : (
            <p className="text-xs text-muted">
              {prop.neighborhood}, {prop.city}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={publishing || editing}
          onClick={() => void handlePublish()}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-40"
        >
          <Rocket size={16} />
          {publishing ? "Publicando…" : "Publicar anuncio"}
        </button>
        <button
          type="button"
          disabled={publishing || editing}
          onClick={() => void handleEdit()}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-40"
        >
          <Edit2 size={16} />
          {editing ? "Abriendo editor…" : "Editar anuncio"}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Al publicar aceptas los{" "}
        <a href="/legal/terminos" className="underline">Términos y Condiciones</a>{" "}
        y el{" "}
        <a href="/legal/privacidad" className="underline">Aviso de Privacidad</a> de Bestie.
      </p>
    </div>
  );
}
