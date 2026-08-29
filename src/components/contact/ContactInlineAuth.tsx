import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { AuthIdentifierField } from "@/components/auth/AuthIdentifierField";
import { AuthMethodDivider, SocialSignInButtons } from "@/components/GoogleSignInButton";
import { authLogin, authRegister, authPhoneOtpRequest, authPhoneRegister, authMe, type AuthMe } from "@/lib/authApi";
import { AUTH_IDENTIFIER_INVALID_MESSAGE, classifyAuthIdentifier } from "@/lib/authIdentifier";
import { setContactPendingDraft } from "@/lib/contactSupportSession";
import { identifyUser, track } from "@/lib/analytics";
import { uploadMessageAttachment, type MessageAttachment } from "@/lib/messagesApi";

type AuthTab = "login" | "register";

const CONTACT_OAUTH_RETURN_TO = "/contacto?resume=1";

/**
 * Modal sign-in/sign-up on Contacto. Email auth stays on-page so local File attachments
 * survive. Google still redirects — attachments are pre-uploaded and URL-stashed in sessionStorage.
 */
export function ContactInlineAuth({
  subject,
  message,
  files,
  uploadedAttachments,
  oauthReturnTo = CONTACT_OAUTH_RETURN_TO,
  onClose,
  onAuthenticated,
}: {
  subject: string;
  message: string;
  files: File[];
  uploadedAttachments: MessageAttachment[];
  /** Where Google OAuth should land to resume the draft (defaults to Contacto). */
  oauthReturnTo?: string;
  onClose: () => void;
  onAuthenticated: (me: AuthMe) => void;
}) {
  const titleId = useId();
  const [tab, setTab] = useState<AuthTab>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpForPhone, setOtpForPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !oauthBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, oauthBusy, onClose]);

  const classified = classifyAuthIdentifier(identifier);
  const isPhone = classified.kind === "phone";

  const onIdentifierChange = (next: string) => {
    setIdentifier(next);
    const nextClass = classifyAuthIdentifier(next);
    if (otpSent && (nextClass.kind !== "phone" || nextClass.phone !== otpForPhone)) {
      setOtpSent(false);
      setOtpCode("");
      setDevCode(null);
      setOtpForPhone(null);
    }
  };

  const finishAuth = async (method: "email" | "phone", kind: "login" | "register") => {
    const me = await authMe().catch(() => null);
    if (!me) throw new Error("No pudimos confirmar tu sesión. Intenta de nuevo.");
    identifyUser(me.id, { email: me.email, name: me.displayName, is_admin: me.isAdmin });
    track(kind === "login" ? "user_logged_in" : "user_signed_up", { method });
    window.dispatchEvent(new Event("bestie:me-changed"));
    onAuthenticated(me);
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const id = classifyAuthIdentifier(identifier);
    if (id.kind === "undetermined") {
      setErr(AUTH_IDENTIFIER_INVALID_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      if (id.kind === "phone") {
        await authLogin({ phone: id.phone, password });
        await finishAuth("phone", "login");
      } else {
        await authLogin({ email: id.email, password });
        await finishAuth("email", "login");
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password !== passwordConfirm) {
      setErr("Las contraseñas no coinciden.");
      return;
    }
    const id = classifyAuthIdentifier(identifier);
    if (id.kind === "undetermined") {
      setErr(AUTH_IDENTIFIER_INVALID_MESSAGE);
      return;
    }
    if (id.kind === "phone") {
      if (!displayName.trim()) {
        setErr("Escribe un nombre para mostrar.");
        return;
      }
      if (!otpSent) {
        setBusy(true);
        try {
          const r = await authPhoneOtpRequest(id.phone);
          setOtpSent(true);
          setOtpForPhone(id.phone);
          setDevCode(r.devCode ?? null);
        } catch (x) {
          setErr(x instanceof Error ? x.message : "No se pudo enviar el código.");
        } finally {
          setBusy(false);
        }
        return;
      }
      setBusy(true);
      try {
        await authPhoneRegister({
          phone: id.phone,
          code: otpCode.trim(),
          password,
          displayName: displayName.trim(),
        });
        await finishAuth("phone", "register");
      } catch (x) {
        setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await authRegister({
        email: id.email,
        password,
        displayName: displayName.trim() || undefined,
      });
      await finishAuth("email", "register");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const prepareOauthDraft = async (): Promise<boolean> => {
    setErr(null);
    setOauthBusy(true);
    try {
      const attachments: MessageAttachment[] = [...uploadedAttachments];
      for (const file of files) {
        attachments.push(await uploadMessageAttachment(file));
      }
      setContactPendingDraft({
        subject,
        message,
        attachments,
      });
      return true;
    } catch (x) {
      setErr(
        x instanceof Error
          ? x.message
          : "No se pudieron guardar tus adjuntos. Intenta de nuevo o usa correo.",
      );
      return false;
    } finally {
      setOauthBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] overflow-y-auto overscroll-y-contain bg-black/50 px-3 py-2 sm:px-4 sm:py-8"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && !oauthBusy) onClose();
      }}
    >
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center">
        <div
          className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900 sm:p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id={titleId} className="text-lg font-bold leading-tight text-primary">
                Inicia sesión para enviar
              </h2>
              <p className="mt-1 text-xs text-muted">
                Tu asunto, mensaje y adjuntos se conservan en esta pantalla.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy || oauthBusy}
              className="rounded-full px-2 py-1 text-sm text-muted hover:bg-surface-elevated disabled:opacity-50"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex rounded-full border border-border bg-bg-light p-0.5 text-sm font-semibold">
            <button
              type="button"
              className={`flex-1 rounded-full py-1.5 ${tab === "login" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
              onClick={() => {
                setTab("login");
                setErr(null);
                setPasswordConfirm("");
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full py-1.5 ${tab === "register" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
              onClick={() => {
                setTab("register");
                setErr(null);
                setPasswordConfirm("");
              }}
            >
              Registro
            </button>
          </div>

          {err ? (
            <p className="mt-2 text-sm text-error" role="alert">
              {err}
            </p>
          ) : null}

          <div className={`mt-3 ${oauthBusy ? "pointer-events-none opacity-60" : ""}`}>
            <SocialSignInButtons
              returnTo={oauthReturnTo}
              onBeforeNavigate={prepareOauthDraft}
            />
          </div>
          {oauthBusy ? (
            <p className="mt-1.5 text-[11px] text-muted">Guardando tus adjuntos antes de continuar…</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">
              Con Google saldrás un momento; al volver restauramos tu borrador completo, incluidas las
              imágenes.
            </p>
          )}
          <AuthMethodDivider />

          {tab === "login" ? (
            <form className="space-y-2.5" onSubmit={submitLogin}>
              <AuthIdentifierField id="contact-auth-identifier" value={identifier} onChange={onIdentifierChange} />
              <label className="block text-sm font-medium text-body">
                Contraseña
                <PasswordField
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
              </label>
              <p className="text-right text-xs">
                <Link
                  to="/recuperar-contrasena"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>
              <button
                type="submit"
                disabled={busy || oauthBusy}
                className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg disabled:opacity-50"
              >
                {busy ? "Entrando…" : "Entrar y enviar"}
              </button>
            </form>
          ) : (
            <form className="space-y-2" onSubmit={submitRegister}>
              <label className="block min-w-0 text-sm font-medium leading-snug text-body">
                Nombre
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-0.5 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-1.5 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                />
              </label>
              <AuthIdentifierField id="contact-auth-reg-identifier" value={identifier} onChange={onIdentifierChange} />
              {isPhone && otpSent ? (
                <label className="block min-w-0 text-sm font-medium leading-snug text-body">
                  Código SMS
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    size={6}
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-0.5 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-1.5 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                  />
                </label>
              ) : null}
              {devCode ? <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
              <label className="block text-sm font-medium leading-snug text-body">
                Contraseña (mín. 8)
                <PasswordField
                  required
                  minLength={8}
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordConfirm("");
                  }}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  className="mt-0.5 w-full rounded-xl border border-border bg-bg-light px-3 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
                />
              </label>
              <label className="block text-sm font-medium leading-snug text-body">
                Confirmar contraseña
                <PasswordField
                  required
                  minLength={8}
                  name="password_confirm"
                  autoComplete="off"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  className="mt-0.5 w-full rounded-xl border border-border bg-bg-light px-3 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
                />
              </label>
              <button
                type="submit"
                disabled={busy || oauthBusy}
                className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
              >
                {busy ? "Creando…" : isPhone && !otpSent ? "Enviar código" : "Crear cuenta y enviar"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
