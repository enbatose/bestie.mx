import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProfilePhoneStatusBadge } from "@/components/account/ProfilePhoneStatusBadge";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { VerifyPhoneOtpModal } from "@/components/phone/VerifyPhoneOtpModal";
import { authMe, isPhoneVerified, type AuthMe } from "@/lib/authApi";
import { formatMxPhoneDisplay, normalizeMxNationalDigits } from "@/lib/mxPhone";

export function ProfilePage() {
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [verifyPhoneOpen, setVerifyPhoneOpen] = useState(false);

  const load = useCallback(async () => {
    setMe(await authMe().catch(() => null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onMeChanged = () => {
      void load();
    };
    window.addEventListener("bestie:me-changed", onMeChanged);
    return () => window.removeEventListener("bestie:me-changed", onMeChanged);
  }, [load]);

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Perfil</h1>
        <p className="mt-2 text-sm text-muted">Inicia sesión para ver tu cuenta.</p>
        <Link
          to="/entrar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const phoneVerified = isPhoneVerified(me);

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg overflow-x-clip px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-bold text-primary">Perfil</h1>
      <p className="mt-2 text-sm text-muted">
        Hola, <span className="font-medium text-body">{me.displayName}</span>. Aquí ves el estado de tu cuenta y tus
        datos de confianza.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-4">
        <ProfilePictureUpload
          displayName={me.displayName}
          profilePictureUrl={me.profilePictureUrl}
          onUpdated={(profilePictureUrl) => setMe({ ...me, profilePictureUrl })}
        />
      </div>

      <ul className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-4 text-sm">
        <li className="flex min-w-0 items-start justify-between gap-3">
          <span className="shrink-0 pt-0.5 text-body">Teléfono / móvil</span>
          <div className="min-w-0 text-right">
            <p className="min-w-0 truncate tabular-nums text-muted">
              {me.phoneE164 ? formatMxPhoneDisplay(me.phoneE164) : "—"}
            </p>
            {me.phoneE164 ? (
              <div className="mt-1.5 flex justify-end">
                <ProfilePhoneStatusBadge
                  verified={phoneVerified}
                  onVerifyClick={() => setVerifyPhoneOpen(true)}
                />
              </div>
            ) : null}
          </div>
        </li>
        <li className="flex min-w-0 items-center justify-between gap-2">
          <span className="shrink-0 text-body">Correo</span>
          <span className="min-w-0 truncate text-right text-muted">{me.email ?? "—"}</span>
        </li>
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/perfil/editar"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
        >
          Editar datos
        </Link>
      </div>

      <VerifyPhoneOtpModal
        open={verifyPhoneOpen}
        initialPhone={normalizeMxNationalDigits(me.phoneE164 ?? "") ?? ""}
        onClose={() => setVerifyPhoneOpen(false)}
        onVerified={async () => {
          setVerifyPhoneOpen(false);
          await load();
        }}
      />
    </div>
  );
}
