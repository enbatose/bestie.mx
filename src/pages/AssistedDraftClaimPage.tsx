import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useAppShellOutlet } from "@/layouts/appShellOutletContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  activateAssistedDraftClaim,
  fetchAssistedDraftClaim,
  publishAssistedDraftClaim,
} from "@/lib/assistedDraftApi";
import { claimInfoToBundle } from "@/lib/assistedDraftClaim";
import { draftFromPropertyBundle } from "@/pages/PublishWizardPage";
import { publishWizardLastStepIndex } from "@/lib/publishWizard/previewSession";
import { writeAssistedDraftClaimSession, writeAssistedDraftClaimToken } from "@/lib/publishWizard/assistedDraftClaimSession";
import { ensurePublishSessionRecording } from "@/lib/posthog";
import { track } from "@/lib/analytics";

type PageState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "published"; propertyId: string }
  | { phase: "already_claimed" };

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

  useEffect(() => {
    ensurePublishSessionRecording();
  }, []);

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
        const resumeStep = publishWizardLastStepIndex(draft.postMode);
        const createFlow =
          info.source === "self_serve" ? ("ai" as const) : ("assisted" as const);
        track("publish_mode_selected", {
          mode: draft.postMode === "property" ? "property" : "room",
          create_flow: createFlow,
        });
        writeAssistedDraftClaimToken(token);
        writeAssistedDraftClaimSession({ token, draft, serverSync, step: resumeStep });
        navigate(`/publicar?borrador=${encodeURIComponent(token)}`, {
          replace: true,
          state: {
            resumeDraft: draft,
            resumeServerSync: serverSync,
            resumeStep,
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
