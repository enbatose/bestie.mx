import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import {
  authChangePassword,
  authCompletePasswordReset,
  authConsumePasswordReset,
  authLinkPublisher,
  authMe,
  authUpdateMe,
  needsEmailVerification,
  type AuthMe,
} from "@/lib/authApi";
import { parsePhoneInputToE164 } from "@/lib/mxPhone";

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
      setPhone(next.phoneE164 ?? "");
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
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{resetErr}</p>
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

  const isWaOnly = !me.email && Boolean(me.phoneE164);
  const emailChanged = email.trim().toLowerCase() !== (me.email ?? "").toLowerCase();
  const displayNameChanged = displayName.trim() !== (me.displayName ?? "").trim();
  const requiresPasswordForEmail = emailChanged && !isWaOnly;

  const trimmedPhone = phone.trim();
  const parsedPhoneE164 = trimmedPhone === "" ? null : parsePhoneInputToE164(phone);
  const phoneInvalid = trimmedPhone !== "" && parsedPhoneE164 === null;
  const phoneClearAttempt = trimmedPhone === "" && me.phoneE164 != null;
  const phoneChanged =
    parsedPhoneE164 != null && parsedPhoneE164 !== (me.phoneE164 ?? "");

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    if (!displayNameChanged && !emailChanged && !phoneChanged) {
      setProfileMsg("No hay cambios para guardar.");
      return;
    }
    if (phoneInvalid) {
      setProfileErr("Número inválido: usa 10 dígitos o formato +52…");
      return;
    }
    if (phoneClearAttempt) {
      setProfileErr("Para quitar el número guardado hay que usar soporte; puedes cambiarlo por otro válido.");
      return;
    }
    if (requiresPasswordForEmail && !currentPassword) {
      setProfileErr("Ingresa tu contraseña actual para confirmar el cambio de correo.");
      return;
    }
    setSavingProfile(true);
    try {
      const body: { displayName?: string; email?: string; currentPassword?: string; phone?: string } = {};
      if (displayNameChanged) body.displayName = displayName.trim();
      if (emailChanged) {
        body.email = email.trim().toLowerCase();
        if (!isWaOnly) body.currentPassword = currentPassword;
      }
      if (phoneChanged) body.phone = trimmedPhone;
      const r = await authUpdateMe(body);
      if (phoneChanged) {
        await authLinkPublisher().catch(() => undefined);
      }
      if (r.emailChanged) {
        window.dispatchEvent(new Event("bestie:me-changed"));
        navigate("/verificar-correo", { replace: true });
        return;
      }
      setProfileMsg(r.changed ? "Datos actualizados." : "Sin cambios.");
      setCurrentPassword("");
      await load();
    } catch (x) {
      setProfileErr(x instanceof Error ? x.message : "Error");
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
      setPwErr(x instanceof Error ? x.message : "Error");
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
          : "Actualiza el nombre para mostrar, el correo, el número (WhatsApp) y tu contraseña."}
      </p>

      {resetErr ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{resetErr}</p>
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
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{profileErr}</p>
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
          <label className="block text-sm font-medium text-body">
            WhatsApp en cuenta (celular)
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              placeholder="+52 33 … o 10 dígitos"
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          {phoneInvalid ? (
            <p className="text-xs text-red-700">Revisa el número (10 dígitos o +52 seguido del celular).</p>
          ) : null}
          {phoneClearAttempt ? (
            <p className="text-xs text-muted">
              No puedes dejar el campo vacío si ya hay un número; cámbialo por otro válido o pide ayuda a soporte para
              borrarlo.
            </p>
          ) : null}
          {isWaOnly ? (
            <p className="text-xs text-muted">
              Esta cuenta fue creada con WhatsApp OTP. Agregar un correo aquí te permitirá iniciar sesión también con
              correo una vez que definas una contraseña abajo.
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
              (!displayNameChanged && !emailChanged && !phoneChanged) ||
              phoneInvalid ||
              phoneClearAttempt
            }
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </section>
      ) : null}

      {!isWaOnly ? (
        <section
          ref={passwordSectionRef}
          className={`rounded-2xl border border-border bg-surface p-5 ${resetMode ? "mt-0" : "mt-8"}`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Cambiar contraseña</h2>

          {pwMsg ? (
            <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">{pwMsg}</p>
          ) : null}
          {pwErr ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{pwErr}</p>
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
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Contraseña</h2>
          <p className="mt-2 text-xs">
            Esta cuenta entra solo con WhatsApp OTP, por lo que aún no hay contraseña que cambiar.
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
        <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-surface p-6 text-center shadow-xl dark:border-emerald-900/40">
          <div
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
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
