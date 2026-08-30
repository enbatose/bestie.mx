import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { AdminConsentEvidenceForm } from "@/components/admin/AdminConsentEvidenceForm";
import {
  confirmAssistedDraftClaim,
  publishAssistedDraftClaim,
  requestAssistedDraftClaimOtp,
} from "@/lib/assistedDraftApi";
import { adminPublishUnclaimed } from "@/lib/authApi";
import { listingPublicPath, publishWizardEditPath } from "@/lib/listingReference";
import { listingClaimPreviewPath } from "@/lib/publishWizardNavState";
import type { AuthMe } from "@/lib/authApi";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listing: PropertyListing;
  claimToken: string;
  viewer: AuthMe | null | undefined;
};

export function ListingClaimActions({ listing, claimToken, viewer }: Props) {
  const { openLogin } = useAuthModal();
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const returnTo = `${listingPublicPath(listing.id)}?claim=${encodeURIComponent(claimToken)}`;
  const isAdmin = Boolean(viewer?.isAdmin);
  const needsAuth = viewer === null;
  const adminNeedsEvidence = isAdmin && Boolean(listing.unclaimedAdminOutreach);

  const afterConfirm = async (action: "edit" | "publish") => {
    if (action === "edit") {
      window.location.assign(`/publicar?borrador=${encodeURIComponent(claimToken)}`);
      return;
    }
    await publishAssistedDraftClaim(claimToken);
    window.location.assign(listingPublicPath(listing.id));
  };

  const run = async (action: "edit" | "publish") => {
    setErr(null);
    if (needsAuth) {
      openLogin(returnTo);
      return;
    }
    if (isAdmin && action === "edit") {
      navigate(publishWizardEditPath(listing.propertyId, listing.id), {
        state: {
          fromAdminPosts: true,
          claimDraftReturnPath: listingClaimPreviewPath(listing.id, claimToken),
        },
      });
      return;
    }
    setBusy(true);
    try {
      if (!otpSent && listing.hasDraftPhone && !isAdmin) {
        const r = await requestAssistedDraftClaimOtp(claimToken);
        if (r.skipOtp) {
          await confirmAssistedDraftClaim(claimToken);
          await afterConfirm(action);
          return;
        }
        setOtpSent(true);
        setDevCode(r.devCode ?? null);
        setBusy(false);
        return;
      }
      await confirmAssistedDraftClaim(claimToken, otpSent ? code.trim() : undefined);
      await afterConfirm(action);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo continuar.");
      setBusy(false);
    }
  };

  const publishWithEvidence = async (file: File, note?: string) => {
    setErr(null);
    setBusy(true);
    try {
      await adminPublishUnclaimed(listing.propertyId, file, note);
      window.location.assign(listingPublicPath(listing.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo publicar.");
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 min-w-0 rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <p className="text-sm font-semibold text-primary">Este anuncio aún no está publicado</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Quien tenga el enlace puede verlo.
        {needsAuth
          ? " Inicia sesión para editarlo o publicarlo."
          : adminNeedsEvidence
            ? " Editar no lo reclama. Para publicarlo sin dueño, adjunta una captura de consentimiento."
            : isAdmin
              ? " Editar no lo reclama. Publicar lo deja a tu nombre."
              : " Editar o publicar lo deja a tu nombre."}
      </p>
      {err ? (
        <p role="alert" className="mt-2 break-words text-sm text-error">
          {err}{" "}
          {err.includes("otra cuenta") ? (
            <Link to="/entrar" className="font-semibold underline-offset-2 hover:underline">
              Entrar
            </Link>
          ) : null}
          {err.includes("celular verificado") || err.includes("teléfono de tu perfil") ? (
            <Link to="/perfil/editar" className="font-semibold underline-offset-2 hover:underline">
              Cambiar teléfono de perfil
            </Link>
          ) : null}
        </p>
      ) : null}
      {otpSent ? (
        <label className="mt-3 block text-sm font-medium text-body">
          Código SMS
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            size={6}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
          />
        </label>
      ) : null}
      {devCode ? <p className="mt-1 text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("edit")}
          className="inline-flex min-h-10 min-w-0 items-center rounded-full border border-primary/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {busy ? "…" : otpSent ? "Confirmar y editar" : "Editar"}
        </button>
        {adminNeedsEvidence ? null : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("publish")}
            className="inline-flex min-h-10 min-w-0 items-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "…" : otpSent ? "Confirmar y publicar" : "Publicar"}
          </button>
        )}
      </div>
      {adminNeedsEvidence ? (
        <div className="mt-3">
          <AdminConsentEvidenceForm busy={busy} onPublish={publishWithEvidence} />
        </div>
      ) : isAdmin ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          ¿Publicar sin asignar dueño?{" "}
          <Link to="/admin/posts" className="font-semibold underline-offset-2 hover:underline">
            Admin → Posts
          </Link>{" "}
          (captura de consentimiento).
        </p>
      ) : null}
    </div>
  );
}
