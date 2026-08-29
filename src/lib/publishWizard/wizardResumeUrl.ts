/**
 * In-progress publish wizard identity in the URL.
 * Public share cards stay on `/anuncio/A…` and `/propiedad/P…` — this is only `/publicar`.
 */
import { PUBLISH_PREVIEW_EDITOR_QUERY, wizardPropertyEditCode, wizardRoomEditCode } from "@/lib/listingReference";

export const WIZARD_PASO_QUERY = "paso";

export function hasWizardResumeQuery(params: URLSearchParams): boolean {
  return Boolean(
    params.get("edit")?.trim() ||
      params.get("borrador")?.trim() ||
      params.get("handoff")?.trim() ||
      params.get(WIZARD_PASO_QUERY)?.trim() ||
      params.get("publishStep")?.trim() ||
      params.get("room")?.trim(),
  );
}

/** 0-based wizard step from `paso` (1-based, user-facing) or legacy `publishStep`. */
export function readWizardPasoIndex(params: URLSearchParams): number | null {
  const paso = params.get(WIZARD_PASO_QUERY);
  if (paso != null && paso !== "") {
    const n = Number.parseInt(paso, 10);
    if (Number.isFinite(n) && n >= 1) return n - 1;
  }
  const publishStep = params.get("publishStep");
  if (publishStep != null && publishStep !== "") {
    const n = Number.parseInt(publishStep, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Keep an in-progress `/publicar?edit=…` URL when the Publicar nav is clicked.
 * Bare `/publicar` from other pages still starts a new listing.
 */
export function publicarNavPath(pathname: string, search: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/publicar" && search) return `/publicar${search}`;
  return "/publicar";
}

export type ApplyWizardResumeSearchInput = {
  propertyId?: string | null;
  roomId?: string | null;
  stepIndex?: number;
  /** Claim flow: keep `borrador` and do not write `edit`. */
  assistedDraftToken?: string | null;
  /** AI Datos before compose: autosave must not look like a live `?edit=` session. */
  clearEdit?: boolean;
  /** Hub/admin Editar: keep `vista=1` so drafts open the pencil preview. */
  previewEditor?: boolean;
};

export function applyWizardResumeSearchParams(
  prev: URLSearchParams,
  input: ApplyWizardResumeSearchInput,
): URLSearchParams {
  const next = new URLSearchParams(prev);

  if (input.assistedDraftToken) {
    next.set("borrador", input.assistedDraftToken);
    next.delete("edit");
    next.delete(PUBLISH_PREVIEW_EDITOR_QUERY);
  } else if (input.propertyId) {
    next.set("edit", wizardPropertyEditCode(input.propertyId));
  } else if (input.clearEdit) {
    next.delete("edit");
    next.delete(PUBLISH_PREVIEW_EDITOR_QUERY);
  }

  if (input.previewEditor) {
    next.set(PUBLISH_PREVIEW_EDITOR_QUERY, "1");
  } else if (input.clearEdit) {
    next.delete(PUBLISH_PREVIEW_EDITOR_QUERY);
  }

  if (input.roomId) {
    next.set("room", wizardRoomEditCode(input.roomId));
  }

  if (typeof input.stepIndex === "number" && Number.isFinite(input.stepIndex)) {
    const paso = Math.max(1, Math.floor(input.stepIndex) + 1);
    next.set(WIZARD_PASO_QUERY, String(paso));
    next.delete("publishStep");
  }

  return next;
}
