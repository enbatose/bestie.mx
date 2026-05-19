import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EditableListingPreview } from "@/components/publish/EditableListingPreview";
import { authMe, type AuthMe } from "@/lib/authApi";
import { isListingsApiConfigured } from "@/lib/listingsApi";
import {
  getPublishBlockedReason,
  publishDraftFromWizard,
  saveDraftFromWizard,
} from "@/lib/publishWizard/publishCore";
import {
  publishWizardLastStepIndex,
  publishWizardPhotosStepIndex,
  readPublishPreviewSession,
  writePublishPreviewSession,
  type PublishPreviewSession,
} from "@/lib/publishWizard/previewSession";
import type { Draft } from "@/pages/PublishWizardPage";

type LocationState = {
  previewSession?: PublishPreviewSession;
};

export function PublishPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const apiOn = isListingsApiConfigured();

  const initialSession = useMemo(() => {
    const fromNav = (location.state as LocationState | null)?.previewSession;
    if (fromNav?.draft) return fromNav;
    return readPublishPreviewSession();
  }, [location.state]);

  const [draft, setDraft] = useState<Draft | null>(initialSession?.draft ?? null);
  const [serverSync, setServerSync] = useState(initialSession?.serverSync ?? { propertyId: null, roomIds: [] });
  const [returnStep, setReturnStep] = useState(initialSession?.returnStep ?? publishWizardLastStepIndex("room"));
  const [editingLiveProperty, setEditingLiveProperty] = useState(
    initialSession?.editingLiveProperty ?? null,
  );
  const [roomIndex, setRoomIndex] = useState(0);
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [submitInFlight, setSubmitInFlight] = useState<"publish" | "draft" | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(initialSession?.draft.legalAccepted ?? false);

  useEffect(() => {
    if (!apiOn) {
      setMe(null);
      return;
    }
    void authMe().then(setMe).catch(() => setMe(null));
  }, [apiOn]);

  useEffect(() => {
    if (!draft) {
      navigate("/publicar", { replace: true });
    }
  }, [draft, navigate]);

  const persistSession = useCallback(
    (nextDraft: Draft, nextSync = serverSync) => {
      const session: PublishPreviewSession = {
        draft: nextDraft,
        serverSync: nextSync,
        returnStep,
        editingLiveProperty,
      };
      writePublishPreviewSession(session);
    },
    [returnStep, editingLiveProperty, serverSync],
  );

  const onDraftChange = useCallback(
    (updater: (d: Draft) => Draft) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        persistSession({ ...next, legalAccepted });
        return next;
      });
    },
    [legalAccepted, persistSession],
  );

  const publishBlockedReason = useMemo(() => {
    if (!draft) return null;
    return getPublishBlockedReason({ ...draft, legalAccepted });
  }, [draft, legalAccepted]);

  const goBackToWizard = useCallback(
    (targetStep?: number) => {
      if (!draft) return;
      navigate("/publicar", {
        state: {
          resumeDraft: { ...draft, legalAccepted },
          resumeServerSync: serverSync,
          resumeStep: targetStep ?? returnStep,
        },
      });
    },
    [draft, legalAccepted, navigate, returnStep, serverSync],
  );

  async function handleSaveDraft() {
    if (!draft) return;
    setActionErr(null);
    setSubmitInFlight("draft");
    try {
      const result = await saveDraftFromWizard({ draft, serverSync, apiOn });
      if (result.error) {
        setActionErr(result.error);
        return;
      }
      setServerSync(result.serverSync);
      persistSession(draft, result.serverSync);
      navigate("/mis-anuncios", { state: { draftSaved: true } });
    } finally {
      setSubmitInFlight(null);
    }
  }

  async function handlePublish() {
    if (!draft) return;
    setActionErr(null);
    setSubmitInFlight("publish");
    try {
      const result = await publishDraftFromWizard({
        draft: { ...draft, legalAccepted },
        serverSync,
        editingLiveProperty,
        apiOn,
        isLoggedIn: Boolean(me?.id),
      });
      if (result.kind === "auth_required") {
        navigate("/entrar", {
          replace: true,
          state: {
            registrationNotice:
              "Tu anuncio ya está creado como borrador. Para activarlo y publicarlo, inicia sesión o crea una cuenta.",
          },
        });
        return;
      }
      if (result.kind === "error") {
        setActionErr(result.message);
        return;
      }
      navigate(`/anuncio/${result.roomId}`);
    } finally {
      setSubmitInFlight(null);
    }
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted">Cargando vista previa…</p>
      </div>
    );
  }

  const photosStep = publishWizardPhotosStepIndex(draft.postMode);
  const roomsStep = 3;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="text-sm text-muted">
        <button
          type="button"
          onClick={() => goBackToWizard()}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          ← Volver al asistente
        </button>
      </nav>

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Vista previa del anuncio</h1>
        <p className="mt-2 text-sm text-muted">
          Así se verá tu anuncio publicado. Toca <strong className="font-medium text-body">Editar</strong> en cada
          bloque para cambiar el contenido aquí mismo; los cambios se conservan al volver al asistente.
        </p>
      </header>

      {draft.rooms.length > 1 ? (
        <label className="mt-6 block text-sm font-medium text-body">
          Recámara en vista previa
          <select
            value={roomIndex}
            onChange={(e) => setRoomIndex(Number(e.target.value))}
            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {draft.rooms.map((r, i) => (
              <option key={i} value={i}>
                Recámara {i + 1}: {r.title.trim() || `Sin título`}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-6">
        <EditableListingPreview
          draft={draft}
          roomIndex={roomIndex}
          onDraftChange={onDraftChange}
          onEditPhotos={() => goBackToWizard(photosStep)}
          onEditRoomDetails={() => goBackToWizard(roomsStep)}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-body">
          <input
            type="checkbox"
            checked={legalAccepted}
            onChange={(e) => {
              const checked = e.target.checked;
              setLegalAccepted(checked);
              onDraftChange((d) => ({ ...d, legalAccepted: checked }));
            }}
            className="mt-1 size-4 rounded border-border text-primary"
          />
          <span>
            Confirmo que la información es verídica y acepto las responsabilidades legales al publicar en Bestie (v1).
          </span>
        </label>
        {publishBlockedReason ? (
          <p className="mt-3 text-xs text-muted" role="status">
            Para publicar: {publishBlockedReason}
          </p>
        ) : null}
        {actionErr ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {actionErr}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goBackToWizard()}
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
          >
            Volver al asistente
          </button>
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null}
              onClick={() => void handleSaveDraft()}
              className="rounded-full border border-secondary/50 bg-secondary/10 px-5 py-2 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50"
            >
              {submitInFlight === "draft" ? "Guardando…" : "Guardar como borrador"}
            </button>
          ) : null}
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null || Boolean(publishBlockedReason)}
              title={publishBlockedReason ?? undefined}
              onClick={() => void handlePublish()}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {submitInFlight === "publish" ? "Publicando…" : "Publicar"}
            </button>
          ) : (
            <span className="text-xs text-muted">
              Sin API: configura <code className="rounded bg-surface-elevated px-1">VITE_API_URL</code> para publicar.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
