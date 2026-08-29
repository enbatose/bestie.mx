import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  confirmAssistedDraftClaim,
  publishAssistedDraftClaim,
  requestAssistedDraftClaimOtp,
} from "@/lib/assistedDraftApi";
import { listingPublicPath } from "@/lib/listingReference";
import type { AuthMe } from "@/lib/authApi";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listing: PropertyListing;
  claimToken: string;
  viewer: AuthMe | null | undefined;
};

export function ListingClaimActions({ listing, claimToken, viewer }: Props) {
  const { openLogin } = useAuthModal();
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const returnTo = `${listingPublicPath(listing.id)}?claim=${encodeURIComponent(claimToken)}`;
  const isAdmin = Boolean(viewer?.isAdmin);
  const needsAuth = viewer === null;

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
      window.location.assign(`/publicar?borrador=${encodeURIComponent(claimToken)}`);
      return;
    }
    if (isAdmin && action === "publish") {
      setErr("Para publicar un anuncio sin dueño, usa Admin y adjunta evidencia de consentimiento.");
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

  return (
    <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <p className="text-sm font-semibold text-primary">Este anuncio aún no está publicado</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Quien tenga el enlace puede verlo. Para editarlo o publicarlo inicia sesión.
        {listing.hasDraftPhone
          ? " Si el contacto es un celular de México, confirmaremos ese número con un SMS."
          : " Después de entrar, el anuncio queda a tu nombre."}
      </p>
      {err ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {err}{" "}
          {err.includes("otra cuenta") ? (
            <Link to="/entrar" className="font-semibold underline-offset-2 hover:underline">
              Entrar
            </Link>
          ) : null}
          {err.includes("celular verificado") || err.includes("teléfono de tu perfil") ? (
            <Link to="/cuenta" className="font-semibold underline-offset-2 hover:underline">
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
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
      ) : null}
      {devCode ? <p className="mt-1 text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("edit")}
          className="inline-flex items-center rounded-full border border-primary/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {busy ? "…" : otpSent ? "Confirmar y editar" : "Editar"}
        </button>
        {!isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("publish")}
            className="inline-flex items-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "…" : otpSent ? "Confirmar y publicar" : "Publicar"}
          </button>
        ) : null}
      </div>
      {isAdmin ? (
        <p className="mt-2 text-xs text-muted">
          Como admin puedes editar sin reclamar. Para publicar un anuncio sin dueño, usa Admin →
          Posts y adjunta una captura de consentimiento (no las fotos del anuncio). Esa evidencia no
          se muestra al público ni al dueño posterior.
        </p>
      ) : null}
    </div>
  );
}
