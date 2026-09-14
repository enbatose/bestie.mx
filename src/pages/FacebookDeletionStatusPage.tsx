import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchFacebookDeletionStatus, type FacebookDeletionStatus } from "@/lib/authApi";
import { LEGAL_OPERATOR } from "@/pages/legal/legalUi";

function statusCopy(data: FacebookDeletionStatus): { title: string; body: string } {
  if (!data.found) {
    return {
      title: "No encontramos esa solicitud",
      body: "El código no coincide con una petición de Facebook que hayamos registrado. Revisa que lo copiaste completo o escríbenos desde el correo de tu cuenta.",
    };
  }
  if (data.status === "erased") {
    return {
      title: "Cuenta eliminada",
      body: "Procesamos la solicitud de Facebook. Desvinculamos el inicio de sesión y cancelamos la cuenta de Bestie que se había creado solo con Facebook.",
    };
  }
  if (data.status === "unlinked") {
    return {
      title: "Facebook desvinculado",
      body: "Procesamos la solicitud de Facebook. Ya no usamos ese inicio de sesión. Si tu cuenta de Bestie también tiene correo, Google u otro método, esa cuenta sigue activa; puedes pedir la cancelación completa por correo.",
    };
  }
  return {
    title: "Solicitud recibida",
    body: "No había una cuenta de Bestie ligada a ese Facebook, o ya estaba desvinculada. No queda identificador de Facebook asociado.",
  };
}

export function FacebookDeletionStatusPage() {
  const [searchParams] = useSearchParams();
  const code = (searchParams.get("code") ?? "").trim();
  const [data, setData] = useState<FacebookDeletionStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(Boolean(code));

  useEffect(() => {
    if (!code) {
      setBusy(false);
      setData(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setErr(null);
    void fetchFacebookDeletionStatus(code)
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "No se pudo consultar el estado.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const copy = data ? statusCopy(data) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-md overflow-x-clip px-3 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Facebook</p>
      <h1 className="mt-1 break-words text-2xl font-bold text-primary">Eliminación de datos</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Esta página confirma el estado de una solicitud que Facebook nos envía cuando usas “Enviar
        solicitud” en Apps y sitios web. No muestra tu correo ni tu identificador de Facebook.
      </p>

      {!code ? (
        <p className="mt-6 text-sm leading-relaxed text-body">
          Abre el enlace que Facebook te muestra, o pega el código de confirmación en la dirección
          como <code className="break-all text-xs">/eliminar-facebook?code=…</code>.
        </p>
      ) : null}

      {code ? (
        <p className="mt-4 break-all text-xs text-muted">
          Código: <span className="font-mono text-body">{code}</span>
        </p>
      ) : null}

      {busy ? <p className="mt-6 text-sm text-muted">Consultando…</p> : null}
      {err ? <p className="mt-6 text-sm text-error">{err}</p> : null}
      {copy && !busy ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-primary">{copy.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">{copy.body}</p>
        </div>
      ) : null}

      <p className="mt-8 text-sm leading-relaxed text-muted">
        Instrucciones completas:{" "}
        <Link
          to="/legal/privacidad#eliminacion-de-datos"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Aviso de Privacidad
        </Link>
        . Contacto:{" "}
        <a
          className="font-medium text-primary underline-offset-2 hover:underline"
          href={`mailto:${LEGAL_OPERATOR.contactEmail}`}
        >
          {LEGAL_OPERATOR.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}
