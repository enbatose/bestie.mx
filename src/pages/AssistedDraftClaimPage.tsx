import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ListingTag, ListingStatus, PropertyKind, LodgingType, RoommateGenderPref, RoomDimension, PropertyWithRooms } from "@/types/listing";
import { useAppShellOutlet } from "@/layouts/appShellOutletContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  activateAssistedDraftClaim,
  fetchAssistedDraftClaim,
  publishAssistedDraftClaim,
  type AssistedDraftClaimInfo,
} from "@/lib/assistedDraftApi";
import { draftFromPropertyBundle } from "@/pages/PublishWizardPage";
import { publishWizardLastStepIndex } from "@/lib/publishWizard/previewSession";

type PageState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "published"; propertyId: string }
  | { phase: "already_claimed" };

/** Convert the lightweight claim-info response to a PropertyWithRooms so draftFromPropertyBundle can consume it. */
function claimInfoToBundle(info: AssistedDraftClaimInfo): PropertyWithRooms {
  const p = info.property;
  return {
    property: {
      id: info.propertyId,
      publisherId: p.publisherId,
      status: p.status as ListingStatus,
      postMode: p.postMode as "room" | "property",
      title: p.title,
      city: p.city,
      neighborhood: p.neighborhood,
      lat: p.lat,
      lng: p.lng,
      summary: p.summary,
      contactWhatsApp: "",
      propertyKind: (p.propertyKind ?? undefined) as PropertyKind | undefined,
      bedroomsTotal: p.bedroomsTotal,
      bathrooms: p.bathrooms,
      showWhatsApp: p.showWhatsApp,
      imageUrls: p.imageUrls,
      isApproximateLocation: p.isApproximateLocation,
      approximateRadiusMeters: p.approximateRadiusMeters,
    },
    rooms: info.rooms.map((r, i) => ({
      id: r.id,
      propertyId: info.propertyId,
      status: "draft" as ListingStatus,
      title: r.title,
      rentMxn: r.rentMxn,
      depositMxn: r.depositMxn,
      roomsAvailable: 1,
      tags: (r.tags ?? []) as ListingTag[],
      roommateGenderPref: (r.roommateGenderPref ?? "any") as RoommateGenderPref,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      summary: r.summary,
      lodgingType: (r.lodgingType ?? undefined) as LodgingType | undefined,
      availableFrom: r.availableFrom ?? undefined,
      minimalStayMonths: r.minimalStayMonths ?? undefined,
      roomDimension: (r.roomDimension ?? undefined) as RoomDimension | undefined,
      sortOrder: i,
      photos: r.imageUrls,
    })),
  };
}

export function AssistedDraftClaimPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPublish = searchParams.get("publish") === "1";
  const { me } = useAppShellOutlet();
  const { openAuthModal } = useAuthModal();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const didActivate = useRef(false);
  const didPublish = useRef(false);

  // ── Case 1: ?publish=1 — returning from auth, execute publish ────────────
  useEffect(() => {
    if (!autoPublish || !token) return;
    if (me === undefined) return; // auth still loading
    if (didPublish.current) return;
    if (!me) {
      openAuthModal(`/borrador/${token}?publish=1`);
      return;
    }
    didPublish.current = true;
    void (async () => {
      try {
        const { propertyId } = await publishAssistedDraftClaim(token);
        setState({ phase: "published", propertyId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "publish_error";
        if (msg === "already_claimed_by_other") {
          setState({ phase: "already_claimed" });
        } else if (msg === "rent_required") {
          navigate(`/borrador/${token}`, { replace: true });
        } else {
          setState({
            phase: "error",
            message: "No se pudo publicar el anuncio. Intenta de nuevo.",
          });
        }
      }
    })();
  }, [autoPublish, me, token, openAuthModal, navigate]);

  // ── Case 2: no ?publish=1 — activate claim, build draft, redirect to wizard Step 6 ──
  useEffect(() => {
    if (autoPublish || !token || didActivate.current) return;
    didActivate.current = true;
    void (async () => {
      try {
        const info = await fetchAssistedDraftClaim(token);
        if (info.isClaimed) {
          setState({ phase: "already_claimed" });
          return;
        }
        // Set the orphan publisher cookie (suppressed if already activated)
        try {
          await activateAssistedDraftClaim(token);
        } catch {
          // 409 already-activated is harmless
        }
        // Build a wizard draft directly from claim data — avoids /api/properties/:id
        // which rejects assisted-draft property IDs (adraft__ prefix).
        const bundle = claimInfoToBundle(info);
        const { draft, serverSync } = draftFromPropertyBundle(bundle);
        navigate("/publicar", {
          replace: true,
          state: {
            resumeDraft: draft,
            resumeServerSync: serverSync,
            resumeStep: publishWizardLastStepIndex(draft.postMode),
            assistedDraftToken: token,
          },
        });
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
  }, [autoPublish, token, navigate]);

  if (state.phase === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
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
            href="/mis-anuncios"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110"
          >
            Ver mis anuncios
          </a>
        </div>
      </div>
    </div>
  );
}
