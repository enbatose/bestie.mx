import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  publishWizardLastStepIndex,
  readPublishPreviewSession,
  type PublishPreviewSession,
} from "@/lib/publishWizard/previewSession";

type LocationState = {
  previewSession?: PublishPreviewSession;
};

/** Legacy route: redirects into the wizard final step with session restored. */
export function PublishPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const session = useMemo(() => {
    const fromNav = (location.state as LocationState | null)?.previewSession;
    if (fromNav?.draft) return fromNav;
    return readPublishPreviewSession();
  }, [location.state]);

  useEffect(() => {
    if (!session?.draft) {
      navigate("/publicar", { replace: true });
      return;
    }
    navigate("/publicar", {
      replace: true,
      state: {
        resumeDraft: session.draft,
        resumeServerSync: session.serverSync,
        resumeStep: session.returnStep ?? publishWizardLastStepIndex(session.draft.postMode),
      },
    });
  }, [navigate, session]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted">Abriendo revisión final…</p>
    </div>
  );
}
