import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import {
  authLinkPublisher,
  authLogin,
  authLogout,
  authMe,
  authUpdateMe,
  type AuthMe,
} from "@/lib/authApi";

export function SignInPage() {
  const location = useLocation();
  const registrationNotice = (location.state as { registrationNotice?: string } | null)?.registrationNotice;
  const navigate = useNavigate();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [tab, setTab] = useState<"wa" | "email">("email");

  const [phone, setPhone] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const wantsWaTab = (() => {
    const t = new URLSearchParams(location.search).get("tab");
    return t === "wa" || t === "whatsapp";
  })();

  useEffect(() => {
    if (me) return;
    const t = new URLSearchParams(location.search).get("tab");
    if (t === "email") setTab("email");
    else if (t === "wa" || t === "whatsapp") setTab("wa");
  }, [location.search, me]);

  const onSavePhoneLinked = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setPhoneBusy(true);
    try {
      await authUpdateMe({ phone });
      await authLinkPublisher();
      await refreshMe();
      navigate("/mis-anuncios", { replace: true });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setPhoneBusy(false);
    }
  };

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setEmailBusy(true);
    try {
      await authLogin({ email: email.trim().toLowerCase(), password });
      await authLinkPublisher();
      setMsg("Sesión iniciada.");
      await refreshMe();
      navigate("/mis-anuncios", { replace: true });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setEmailBusy(false);
    }
  };

  const onLogout = async () => {
    setErr(null);
    setMsg(null);
    await authLogout();
    await refreshMe();
  };

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (me) {
    if (!me.phoneE164 && wantsWaTab) {
      return (
        <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Tu número (WhatsApp)</h1>
          <p className="mt-2 text-sm text-muted">
            Guardamos tu celular en formato internacional (+52…) para tu cuenta{" "}
            <span className="font-medium text-body">{me.displayName}</span>. Cuando conectemos WhatsApp, podremos
            validarlo desde el chat.
          </p>
          {msg ? (
            <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">{msg}</p>
          ) : null}
          {err ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={onSavePhoneLinked}>
            <label className="block text-sm font-medium text-body">
              Celular (México)
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+52 33 … o 10 dígitos"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={phoneBusy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {phoneBusy ? "Guardando…" : "Guardar número"}
            </button>
          </form>
          <p className="mt-8 text-sm text-muted">
            <Link to="/perfil" className="font-semibold text-primary underline-offset-2 hover:underline">
              Volver al perfil
            </Link>
          </p>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Tu cuenta</h1>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-body">{me.displayName}</span>
          {me.email ? (
            <>
              {" "}
              · <span className="text-body">{me.email}</span>
            </>
          ) : null}
          {me.phoneE164 ? (
            <>
              {" "}
              · <span className="text-body">{me.phoneE164}</span>
            </>
          ) : null}
        </p>
        <p className="mt-4 text-sm text-muted">
          Publicadores vinculados: {me.linkedPublisherIds.length ? me.linkedPublisherIds.length : "ninguno aún"}{" "}
          (se agrega al publicar o al abrir un enlace desde Messenger).
        </p>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="mt-8 w-full rounded-full border border-border py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
        >
          Cerrar sesión
        </button>
        <p className="mt-8 text-sm text-muted">
          <Link to="/publicar" className="font-semibold text-primary underline-offset-2 hover:underline">
            Publicar
          </Link>
          {me.isAdmin ? (
            <>
              {" · "}
              <Link to="/admin" className="font-semibold text-primary underline-offset-2 hover:underline">
                Admin
              </Link>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Entrar</h1>
      {registrationNotice ? (
        <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-xs text-body">
          {registrationNotice}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        Entra con correo y contraseña. La sesión usa cookies seguras con la API. El inicio solo con WhatsApp no está
        disponible por ahora.
      </p>

      <div className="mt-6 flex rounded-full border border-border bg-bg-light p-1 text-sm font-medium">
        <button
          type="button"
          className={`flex-1 rounded-full py-2 transition ${tab === "wa" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => setTab("wa")}
        >
          WhatsApp
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full py-2 transition ${tab === "email" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => setTab("email")}
        >
          Correo
        </button>
      </div>

      {msg ? (
        <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
      ) : null}

      {tab === "wa" ? (
        <div className="mt-6 rounded-xl border border-border bg-bg-light p-4 text-sm text-body">
          <p className="font-medium text-primary">WhatsApp</p>
          <p className="mt-2 text-muted">
            El acceso con código por WhatsApp está desactivado mientras no tenemos la API conectada. Usa la pestaña{" "}
            <button
              type="button"
              className="font-semibold text-primary underline underline-offset-2"
              onClick={() => setTab("email")}
            >
              Correo
            </button>{" "}
            para entrar, o{" "}
            <Link to="/registro" className="font-semibold text-primary underline-offset-2 hover:underline">
              crea una cuenta
            </Link>
            .
          </p>
        </div>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={onEmailLogin}>
          <label className="block text-sm font-medium text-body">
            Correo
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-body">
            Contraseña
            <PasswordField
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={emailBusy}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {emailBusy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        ¿Sin cuenta?{" "}
        <Link to="/registro" className="font-semibold text-primary underline-offset-2 hover:underline">
          Crear cuenta
        </Link>
      </p>
      <p className="mt-4 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Ir a buscar
        </Link>
      </p>
    </div>
  );
}
