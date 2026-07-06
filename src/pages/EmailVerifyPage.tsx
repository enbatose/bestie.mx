import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  authLogout,
  authMe,
  authResendVerificationEmail,
  authVerifyEmail,
  needsEmailVerification,
  type AuthMe,
} from "@/lib/authApi";

function notifyMeChanged() {
  window.dispatchEvent(new Event("bestie:me-changed"));
}

function digitsFromClipboardText(text: string): string {
  return text.replace(/\D/g, "").slice(0, 6);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function EmailVerifyPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlParamsHandled = useRef(false);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await authMe());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (me === undefined) return;
    if (urlParamsHandled.current) return;
    const fromUrl = digitsFromClipboardText(searchParams.get("code") ?? "");
    if (fromUrl.length !== 6) return;
    if (!me) return;

    urlParamsHandled.current = true;

    setCode(fromUrl);
    setErr(null);

    const shouldCopy = searchParams.get("copy") === "1";
    void (async () => {
      if (shouldCopy) {
        const copied = await copyTextToClipboard(fromUrl);
        setMsg(
          copied
            ? "Código copiado al portapapeles y listo para verificar."
            : "Código cargado. Puedes confirmarlo abajo.",
        );
      } else {
        setMsg("Código cargado desde el enlace del correo.");
      }
    })();

    const next = new URLSearchParams(searchParams);
    next.delete("code");
    next.delete("copy");
    setSearchParams(next, { replace: true });
  }, [me, searchParams, setSearchParams]);

  useEffect(() => {
    if (me && !needsEmailVerification(me)) {
      navigate("/mis-anuncios", { replace: true });
    }
  }, [me, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [me]);

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Verificar correo</h1>
        <p className="mt-2 text-sm text-muted">Inicia sesión para confirmar tu correo.</p>
        <Link
          to="/entrar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const email = me.email ?? "";

  return (
    <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Validación pendiente
        </p>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-primary">Confirma tu correo</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Enviamos un código de 6 dígitos a{" "}
        <span className="font-medium text-body">{email}</span>. Revisa tu bandeja de entrada; si no lo ves, busca en{" "}
        <span className="font-medium text-body">spam</span> o <span className="font-medium text-body">promociones</span>
        . El código también aparece en el asunto del correo para que no tengas que abrirlo.
      </p>

      {msg ? (
        <p className="mt-4 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm text-body">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">
          {err}
        </p>
      ) : null}
      {devCode ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-bg-light p-3 text-sm text-muted">
          Código de desarrollo: <span className="font-mono font-bold tracking-widest text-body">{devCode}</span>
        </p>
      ) : null}

      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setMsg(null);
          const trimmed = code.replace(/\D/g, "").slice(0, 6);
          if (trimmed.length !== 6) {
            setErr("Ingresa los 6 dígitos del correo.");
            return;
          }
          setBusy(true);
          try {
            await authVerifyEmail(trimmed);
            notifyMeChanged();
            navigate("/mis-anuncios", { replace: true });
          } catch (x) {
            const message = x instanceof Error ? x.message : "No se pudo completar la acción.";
            if (message === "code_expired") {
              setErr("El código expiró. Solicita uno nuevo.");
            } else if (message === "invalid_code") {
              setErr("Código incorrecto. Revisa el correo e inténtalo de nuevo.");
            } else if (message === "too_many_attempts") {
              setErr("Demasiados intentos. Solicita un código nuevo.");
            } else {
              setErr(message);
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm font-medium text-body">
          Código de verificación
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.35em] text-body outline-none ring-accent focus:ring-2"
          />
        </label>
        <button
          type="button"
          disabled={pasteBusy}
          onClick={async () => {
            setErr(null);
            setMsg(null);
            setPasteBusy(true);
            try {
              const text = await navigator.clipboard.readText();
              const digits = digitsFromClipboardText(text);
              if (digits.length !== 6) {
                setErr("No hay un código de 6 dígitos en el portapapeles.");
                return;
              }
              setCode(digits);
              setMsg("Código pegado desde el portapapeles.");
              inputRef.current?.focus();
            } catch {
              setErr("No pudimos leer el portapapeles. Pega manualmente en el campo o usa el enlace del correo.");
            } finally {
              setPasteBusy(false);
            }
          }}
          className="w-full rounded-full border border-border bg-surface py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated disabled:opacity-60"
        >
          {pasteBusy ? "Leyendo portapapeles…" : "Pegar código copiado"}
        </button>
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Verificando…" : "Confirmar correo"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={resendBusy}
          onClick={async () => {
            setErr(null);
            setMsg(null);
            setDevCode(null);
            setResendBusy(true);
            try {
              const r = await authResendVerificationEmail();
              setMsg("Te enviamos un código nuevo. Revisa tu correo (y spam).");
              if (r.devCode) setDevCode(r.devCode);
            } catch (x) {
              setErr(x instanceof Error ? x.message : "No se pudo reenviar el correo.");
            } finally {
              setResendBusy(false);
            }
          }}
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60"
        >
          {resendBusy ? "Reenviando…" : "Reenviar código"}
        </button>
        <Link to="/perfil/editar" className="text-sm font-medium text-muted underline-offset-2 hover:underline">
          Cambiar correo
        </Link>
      </div>

      <button
        type="button"
        onClick={async () => {
          await authLogout();
          notifyMeChanged();
          navigate("/entrar", { replace: true });
        }}
        className="mt-10 text-sm text-muted underline-offset-2 hover:underline"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
