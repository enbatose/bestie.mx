import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import { PasswordField } from "@/components/PasswordField";
import {
  authChangePassword,
  authCompletePasswordReset,
  authConsumePasswordReset,
  authMe,
  authUpdateMe,
  type AuthMe,
} from "@/lib/authApi";
import { normalizeMxNationalDigits, phoneDigitsForStorage } from "@/lib/mxPhone";

export function AccountEditPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const passwordSectionRef = useRef<HTMLElement | null>(null);
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [resetMode, setResetMode] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetReady, setResetReady] = useState(false);
  const [shouldScrollToPassword, setShouldScrollToPassword] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneNotifyOptIn, setPhoneNotifyOptIn] = useState(true);
  const [phoneMarketingOptIn, setPhoneMarketingOptIn] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [passwordResetSuccessOpen, setPasswordResetSuccessOpen] = useState(false);

  const load = useCallback(async () => {
    const next = await authMe().catch(() => null);
    setMe(next);
    if (next) {
      setDisplayName(next.displayName ?? "");
      setEmail(next.email ?? "");
      setPhone(normalizeMxNationalDigits(next.phoneE164 ?? "") ?? "");
      setPhoneNotifyOptIn(next.phoneNotifyOptIn);
      setPhoneMarketingOptIn(next.phoneMarketingOptIn);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = searchParams.get("reset")?.trim();
    if (!token) return;

    let cancelled = false;
    void (async () => {
      setResetErr(null);
      try {
        await authConsumePasswordReset(token);
        if (cancelled) return;
        setResetMode(true);
        setResetToken(token);
        setResetReady(true);
        setShouldScrollToPassword(true);
        window.dispatchEvent(new Event("bestie:me-changed"));
        await load();
        const next = new URLSearchParams(searchParams);
        next.delete("reset");
        setSearchParams(next, { replace: true });
      } catch (x) {
        if (!cancelled) {
          setResetErr(x instanceof Error ? x.message : "Enlace inválido.");
          setResetReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load, searchParams, setSearchParams]);

  useEffect(() => {
    if (!shouldScrollToPassword || me === undefined) return;
    const t = window.setTimeout(() => {
      passwordSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setShouldScrollToPassword(false);
    }, 80);
    return () => window.clearTimeout(t);
  }, [shouldScrollToPassword, me]);

  useEffect(() => {
    if (!passwordResetSuccessOpen) return;
    const t = window.setTimeout(() => {
      navigate("/mis-anuncios", { replace: true });
    }, 3000);
    return () => window.clearTimeout(t);
  }, [passwordResetSuccessOpen, navigate]);

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  const resetTokenFromUrl = searchParams.get("reset")?.trim();
  if (!me && resetTokenFromUrl && !resetReady) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-muted">Validando enlace…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Editar cuenta</h1>
        {resetErr ? (
          <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{resetErr}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">Inicia sesión para editar tus datos.</p>
        )}
        <Link
          to="/entrar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Entrar
        </Link>
        {resetErr ? (
          <p className="mt-4 text-sm text-muted">
            <Link to="/recuperar-contrasena" className="font-semibold text-primary underline-offset-2 hover:underline">
              Solicitar un enlace nuevo
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  /** Legacy accounts created without email (e.g. former OTP) cannot change password here. */
  const isPhoneOnlyAccount = !me.email && Boolean(me.phoneE164);
  const isPublisher = me.linkedPublisherIds.length > 0;
  const emailChanged = email.trim().toLowerCase() !== (me.email ?? "").toLowerCase();
  const displayNameChanged = displayName.trim() !== (me.displayName ?? "").trim();
  const nextPhoneDigits = phone.trim() ? phoneDigitsForStorage(phone) : null;
  const currentPhoneDigits = me.phoneE164 ? phoneDigitsForStorage(me.phoneE164) : null;
  const phoneChanged = nextPhoneDigits !== currentPhoneDigits;
  const phoneNotifyChanged = phoneNotifyOptIn !== me.phoneNotifyOptIn;
  const phoneMarketingChanged = phoneMarketingOptIn !== me.phoneMarketingOptIn;
  const requiresPasswordForEmail = emailChanged && !isPhoneOnlyAccount;

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    if (!displayNameChanged && !emailChanged && !phoneChanged && !phoneNotifyChanged && !phoneMarketingChanged) {
      setProfileMsg("No hay cambios para guardar.");
      return;
    }
    if (requiresPasswordForEmail && !currentPassword) {
      setProfileErr("Ingresa tu contraseña actual para confirmar el cambio de correo.");
      return;
    }
    if (phone.trim() && !nextPhoneDigits) {
      setProfileErr("Completa un número válido de 10 dígitos.");
      return;
    }
    setSavingProfile(true);
    try {
      const body: {
        displayName?: string;
        email?: string;
        currentPassword?: string;
        phone?: string;
        phoneNotifyOptIn?: boolean;
        phoneMarketingOptIn?: boolean;
      } = {};
      if (displayNameChanged) body.displayName = displayName.trim();
      if (emailChanged) {
        body.email = email.trim().toLowerCase();
        if (!isPhoneOnlyAccount) body.currentPassword = currentPassword;
      }
      if (phoneChanged) body.phone = phone.trim();
      if (phoneNotifyChanged) body.phoneNotifyOptIn = phoneNotifyOptIn;
      if (phoneMarketingChanged) body.phoneMarketingOptIn = phoneMarketingOptIn;
      const r = await authUpdateMe(body);
      if (r.emailChanged) {
        window.dispatchEvent(new Event("bestie:me-changed"));
        navigate("/verificar-correo", { replace: true });
        return;
      }
      setProfileMsg(r.changed ? "Datos actualizados." : "Sin cambios.");
      setCurrentPassword("");
      await load();
    } catch (x) {
      setProfileErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (pwNew.length < 8) {
      setPwErr("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwErr("La confirmación no coincide.");
      return;
    }
    setSavingPassword(true);
    try {
      if (resetMode && resetToken) {
        await authCompletePasswordReset({ token: resetToken, newPassword: pwNew });
        setResetMode(false);
        setResetToken(null);
        setPasswordResetSuccessOpen(true);
      } else {
        await authChangePassword({ currentPassword: pwCurrent, newPassword: pwNew });
        setPwMsg("Contraseña actualizada.");
      }
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      window.dispatchEvent(new Event("bestie:me-changed"));
    } catch (x) {
      setPwErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
    <div className="mx-auto max-w-lg px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">Editar cuenta</h1>
        <button
          type="button"
          onClick={() => navigate("/perfil")}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-body hover:bg-surface-elevated"
        >
          Volver al perfil
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        {resetMode
          ? "Elige una contraseña nueva para tu cuenta."
          : "Actualiza el nombre para mostrar, el correo y tu contraseña."}
      </p>

      {resetErr ? (
        <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{resetErr}</p>
      ) : null}
      {resetMode ? (
        <p className="mt-4 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm text-body">
          Restablecimiento de contraseña activo. Guarda la nueva contraseña abajo.
        </p>
      ) : null}

      {!resetMode ? (
      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Datos de la cuenta</h2>

        {profileMsg ? (
          <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">{profileMsg}</p>
        ) : null}
        {profileErr ? (
          <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{profileErr}</p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={onSaveProfile}>
          <label className="block text-sm font-medium text-body">
            Nombre para mostrar
            <input
              type="text"
              value={displayName}
              onChange={(ev) => setDisplayName(ev.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-body">
            Correo
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <div className="rounded-2xl border border-border bg-bg-light p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-body">Teléfono</h3>
            <p className="mt-1 text-xs leading-snug text-muted">
              {isPublisher
                ? "Tu número no se muestra automáticamente en tu perfil. Solo aparece en un anuncio si activas esa opción al publicarlo."
                : "Tu número no se muestra a otras personas en tu perfil. Si algún día publicas un anuncio, podrás decidir si mostrarlo ahí."}
            </p>
            <PhoneNumberField
              id="account-phone"
              value={phone}
              onChange={setPhone}
              className="mt-4"
            />
            <div className="mt-4 space-y-2.5 sm:space-y-3">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-body">
                <input
                  type="checkbox"
                  checked={phoneNotifyOptIn}
                  onChange={(event) => setPhoneNotifyOptIn(event.target.checked)}
                  className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
                />
                <span className="min-w-0 leading-snug">
                  <span className="block font-medium text-body">Recibir SMS o WhatsApp de Bestie</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Avisos operativos, seguimiento de soporte y otras notificaciones relacionadas con tu cuenta o actividad.
                  </span>
                </span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-body">
                <input
                  type="checkbox"
                  checked={phoneMarketingOptIn}
                  onChange={(event) => setPhoneMarketingOptIn(event.target.checked)}
                  className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
                />
                <span className="min-w-0 leading-snug">
                  <span className="block font-medium text-body">Recibir promociones y novedades</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Comunicaciones comerciales de Bestie por SMS o WhatsApp. Puedes desactivarlas después desde esta misma pantalla.
                  </span>
                </span>
              </label>
            </div>
          </div>
          {isPhoneOnlyAccount ? (
            <p className="text-xs text-muted">
              Esta cuenta aún no tiene correo. Agregar uno aquí te permitirá iniciar sesión con correo una vez que
              definas una contraseña abajo.
            </p>
          ) : null}
          {requiresPasswordForEmail ? (
            <label className="block text-sm font-medium text-body">
              Contraseña actual (requerida para cambiar correo)
              <PasswordField
                autoComplete="current-password"
                value={currentPassword}
                onChange={(ev) => setCurrentPassword(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
          ) : null}
          <button
            type="submit"
            disabled={
              savingProfile ||
              (!displayNameChanged && !emailChanged && !phoneChanged && !phoneNotifyChanged && !phoneMarketingChanged)
            }
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </section>
      ) : null}

      {!isPhoneOnlyAccount ? (
        <section
          ref={passwordSectionRef}
          className={`rounded-2xl border border-border bg-surface p-5 ${resetMode ? "mt-0" : "mt-8"}`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Cambiar contraseña</h2>

          {pwMsg ? (
            <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">{pwMsg}</p>
          ) : null}
          {pwErr ? (
            <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{pwErr}</p>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={onChangePassword}>
            {!resetMode ? (
              <label className="block text-sm font-medium text-body">
                Contraseña actual
                <PasswordField
                  autoComplete="current-password"
                  value={pwCurrent}
                  onChange={(ev) => setPwCurrent(ev.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
              </label>
            ) : null}
            <label className="block text-sm font-medium text-body">
              Nueva contraseña
              <PasswordField
                autoComplete="new-password"
                minLength={8}
                value={pwNew}
                onChange={(ev) => setPwNew(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Confirmar nueva contraseña
              <PasswordField
                autoComplete="new-password"
                minLength={8}
                value={pwConfirm}
                onChange={(ev) => setPwConfirm(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={
                savingPassword ||
                pwNew.length < 8 ||
                pwNew !== pwConfirm ||
                (!resetMode && !pwCurrent)
              }
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {savingPassword ? "Actualizando…" : resetMode ? "Guardar nueva contraseña" : "Cambiar contraseña"}
            </button>
          </form>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-warning/40 bg-warning/10 p-5 text-sm text-warning-fg">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Contraseña</h2>
          <p className="mt-2 text-xs">
            Esta cuenta aún no tiene correo ni contraseña. Agrega un correo arriba para poder definir una.
          </p>
        </section>
      )}
    </div>

    {passwordResetSuccessOpen ? (
      <div
        className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/45 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-reset-success-title"
      >
        <div className="w-full max-w-sm rounded-2xl border border-secondary/40 bg-surface p-6 text-center shadow-xl">
          <div
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary/15 text-primary"
            aria-hidden="true"
          >
            ✓
          </div>
          <h2 id="password-reset-success-title" className="mt-4 text-lg font-bold text-primary">
            Contraseña actualizada
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Tu contraseña se cambió correctamente. Te llevamos a Mis anuncios en unos segundos…
          </p>
        </div>
      </div>
    ) : null}
    </>
  );
}
