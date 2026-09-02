import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppConfirmDialog } from "@/components/AppConfirmDialog";
import {
  adminArcoErase,
  adminArcoLog,
  adminArcoPreview,
  adminArcoSearch,
  type ArcoEraseReceipt,
  type ArcoPreview,
  type ArcoPriorErasure,
  type ArcoSearchHit,
} from "@/lib/authApi";

function listingStatusLabel(status: string): string {
  if (status === "published") return "Publicado";
  if (status === "paused") return "Pausado";
  if (status === "archived") return "Archivado";
  if (status === "draft") return "Borrador";
  return status;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

type Props = {
  onError: (message: string | null) => void;
};

export function AdminArcoPanel({ onError }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const userFromUrl = searchParams.get("u")?.trim() || "";
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ArcoSearchHit[]>([]);
  const [priorFromSearch, setPriorFromSearch] = useState<ArcoPriorErasure[]>([]);
  const [recent, setRecent] = useState<ArcoPriorErasure[]>([]);
  const [preview, setPreview] = useState<ArcoPreview | null>(null);
  const [receipt, setReceipt] = useState<ArcoEraseReceipt | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("Solicitud ARCO de cancelación");
  const [source, setSource] = useState("whatsapp");
  const [searching, setSearching] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadRecent = useCallback(async () => {
    try {
      const r = await adminArcoLog();
      setRecent(r.erasures);
    } catch {
      /* preview/search errors are more important */
    }
  }, []);

  const loadPreview = useCallback(
    async (userId: string) => {
      setLoadingPreview(true);
      setReceipt(null);
      try {
        const p = await adminArcoPreview(userId);
        setPreview(p);
        setConfirmText("");
        onError(null);
      } catch (x) {
        setPreview(null);
        onError(x instanceof Error ? x.message : "No se pudo cargar la cuenta.");
      } finally {
        setLoadingPreview(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (userFromUrl) void loadPreview(userFromUrl);
  }, [userFromUrl, loadPreview]);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setReceipt(null);
    try {
      const r = await adminArcoSearch(q);
      setHits(r.users);
      setPriorFromSearch(r.priorErasures);
      onError(null);
      if (r.users.length === 1 && r.users[0]) {
        const id = r.users[0].user.id;
        setSearchParams({ u: id }, { replace: true });
      }
    } catch (x) {
      onError(x instanceof Error ? x.message : "No se pudo buscar.");
    } finally {
      setSearching(false);
    }
  };

  const erase = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await adminArcoErase(preview.user.id, {
        emailConfirm: confirmText,
        reason,
        source,
      });
      setReceipt(r);
      setPreview(null);
      setConfirmOpen(false);
      setHits((prev) => prev.filter((h) => h.user.id !== r.userId));
      setSearchParams({}, { replace: true });
      onError(null);
      await loadRecent();
    } catch (x) {
      onError(x instanceof Error ? x.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  };

  const copyWhatsApp = async () => {
    if (!receipt?.whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(receipt.whatsappMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onError("No se pudo copiar. Selecciona el texto a mano.");
    }
  };

  return (
    <div className="mt-6 min-w-0 space-y-5">
      <div className="min-w-0 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-body">Baja ARCO</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Cancelación de cuenta y huella digital (LFPDPPP). Busca por correo, teléfono o id. Revisa el
          inventario y escribe el correo para confirmar. Los chats con otras personas se conservan como
          “Usuario eliminado”; los de Soporte se borran.
        </p>
        <form onSubmit={(e) => void runSearch(e)} className="mt-4 min-w-0">
          <label className="text-sm font-medium text-body" htmlFor="arco-search">
            Buscar titular
          </label>
          <div className="mt-1.5 flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              id="arco-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="correo, teléfono o id"
              autoComplete="off"
              className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="min-h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-50"
            >
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </div>
        </form>
      </div>

      {priorFromSearch.length > 0 && hits.length === 0 ? (
        <p className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-body">
          Esta cuenta ya fue eliminada el {formatWhen(priorFromSearch[0]!.createdAt)} (registro ARCO
          bloqueado).
        </p>
      ) : null}

      {hits.length > 1 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {hits.map((h) => (
            <li key={h.user.id} className="px-4 py-3">
              <button
                type="button"
                onClick={() => setSearchParams({ u: h.user.id }, { replace: true })}
                className="w-full min-w-0 text-left"
              >
                <div className="break-words font-medium text-body">{h.user.displayName || "Sin nombre"}</div>
                <div className="mt-0.5 break-words text-xs text-muted">
                  {h.user.email ?? "sin correo"} · {h.listingCount} anuncio(s)
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {loadingPreview ? <p className="text-sm text-muted">Cargando inventario…</p> : null}

      {preview ? (
        <div className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div className="min-w-0">
            <p className="break-words text-base font-semibold text-body">
              {preview.user.displayName || "Sin nombre"}
            </p>
            <p className="mt-1 break-words text-sm text-muted">
              {preview.user.email ?? "sin correo"} · tel …{preview.user.phoneLast4 ?? "—"} · alta{" "}
              {formatWhen(preview.user.createdAt)}
            </p>
            {preview.oauthProviders.length > 0 ? (
              <p className="mt-1 text-xs text-muted">OAuth: {preview.oauthProviders.join(", ")}</p>
            ) : null}
          </div>

          <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <CountTile label="Anuncios" value={preview.counts.properties} />
            <CountTile label="Recámaras" value={preview.counts.rooms} />
            <CountTile label="Fotos" value={preview.counts.photos} />
            <CountTile label="Chats a conservar" value={preview.counts.listingConversationsKept} />
            <CountTile label="Chats Bestie" value={preview.counts.supportConversationsDeleted} />
            <CountTile label="Búsquedas" value={preview.counts.savedSearches} />
          </ul>

          {preview.listings.length > 0 ? (
            <ul className="space-y-2">
              {preview.listings.map((l) => (
                <li key={l.propertyId} className="min-w-0 rounded-xl border border-border bg-bg-light px-3 py-2 text-sm">
                  <div className="break-words font-medium text-body">{l.title}</div>
                  <div className="text-xs text-muted">
                    {listingStatusLabel(l.status)} · {l.city} · {l.neighborhood} · {l.roomCount} recámara(s)
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin anuncios.</p>
          )}

          {preview.cannotEraseReason ? (
            <p className="rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">
              {preview.cannotEraseReason}
            </p>
          ) : (
            <>
              <label className="block text-sm font-medium text-body" htmlFor="arco-reason">
                Motivo (interno)
              </label>
              <input
                id="arco-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
              />
              <label className="mt-3 block text-sm font-medium text-body" htmlFor="arco-source">
                Canal de la solicitud
              </label>
              <select
                id="arco-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Correo</option>
                <option value="facebook">Facebook</option>
                <option value="admin">Otro (admin)</option>
              </select>
              <label className="mt-3 block text-sm font-medium text-body" htmlFor="arco-confirm">
                {preview.confirmHint}
              </label>
              <input
                id="arco-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
              />
              <button
                type="button"
                disabled={!confirmText.trim()}
                onClick={() => setConfirmOpen(true)}
                className="mt-4 min-h-11 w-full rounded-full border border-error/40 bg-error/10 px-5 text-sm font-semibold text-error hover:bg-error/15 disabled:opacity-50"
              >
                Eliminar cuenta y datos
              </button>
            </>
          )}
        </div>
      ) : null}

      {receipt ? (
        <div className="min-w-0 space-y-3 rounded-2xl border border-secondary/40 bg-secondary/10 p-4">
          <h3 className="text-base font-semibold text-body">Solicitud ARCO completada</h3>
          <p className="text-sm leading-relaxed text-body">
            La cancelación quedó registrada conforme a la LFPDPPP.{" "}
            {receipt.confirmationEmailSent
              ? `Enviamos el correo de confirmación a ${receipt.confirmationEmailMasked}.`
              : receipt.confirmationEmailMasked
                ? `No se pudo enviar el correo a ${receipt.confirmationEmailMasked}; usa el mensaje de WhatsApp.`
                : "No había correo en la cuenta; usa el mensaje de WhatsApp."}
          </p>
          <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <CountTile label="Anuncios" value={receipt.counts.properties} />
            <CountTile label="Recámaras" value={receipt.counts.rooms} />
            <CountTile label="Fotos" value={receipt.counts.photos} />
            <CountTile label="Chats conservados" value={receipt.counts.listingConversationsKept} />
            <CountTile label="Chats Bestie" value={receipt.counts.supportConversationsDeleted} />
          </ul>
          <label className="block text-sm font-medium text-body" htmlFor="arco-wa">
            Mensaje para WhatsApp
          </label>
          <textarea
            id="arco-wa"
            readOnly
            value={receipt.whatsappMessage}
            rows={6}
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface p-3 text-sm leading-relaxed text-body"
          />
          <button
            type="button"
            onClick={() => void copyWhatsApp()}
            className="min-h-11 w-full rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg hover:brightness-110"
          >
            {copied ? "Copiado" : "Copiar mensaje"}
          </button>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-body">Bajas recientes</h3>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
            {recent.map((row) => (
              <li key={row.id} className="px-4 py-2 text-xs text-muted">
                {formatWhen(row.createdAt)} · {row.source}
                {row.confirmationEmailSent ? " · correo enviado" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        Aviso:{" "}
        <Link to="/legal/privacidad#eliminacion-de-datos" className="font-medium text-primary underline-offset-2 hover:underline">
          Eliminación de datos
        </Link>
      </p>

      <AppConfirmDialog
        open={confirmOpen}
        title="Eliminar cuenta"
        message="Esto borra la cuenta, anuncios, fotos y datos personales. No se puede deshacer. Los chats con otras personas quedan como Usuario eliminado."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        intent="danger"
        busy={busy}
        onConfirm={() => void erase()}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
      />
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <li className="min-w-0 rounded-lg border border-border bg-bg-light px-3 py-2">
      <div className="tabular-nums text-base font-semibold text-body">{value}</div>
      <div className="text-muted">{label}</div>
    </li>
  );
}
