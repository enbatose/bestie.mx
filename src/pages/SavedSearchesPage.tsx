import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deleteSavedSearch,
  enableSavedSearchNotify,
  fetchSavedSearches,
  updateSavedSearch,
  type SavedSearchDto,
} from "@/lib/savedSearchesApi";
import { authMe, type AuthMe } from "@/lib/authApi";

export function SavedSearchesPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [rows, setRows] = useState<SavedSearchDto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setRows(await fetchSavedSearches());
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void authMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (me?.id) void load();
  }, [me, load]);

  const onToggleNotify = async (row: SavedSearchDto, enable: boolean) => {
    if (!enable) {
      setBusyId(row.id);
      setErr(null);
      try {
        await updateSavedSearch(row.id, { emailNotifyEnabled: false });
        await load();
      } catch (x) {
        setErr(x instanceof Error ? x.message : "Error");
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (!me?.email) {
      setErr("Agrega un correo en tu perfil para activar alertas por correo.");
      return;
    }

    const other = rows?.find((r) => r.emailNotifyEnabled && r.id !== row.id);
    if (other) {
      const ok = window.confirm(
        `Ya tienes alertas activas para «${other.label}». ¿Quieres recibir alertas de «${row.label}» en su lugar?`,
      );
      if (!ok) return;
    }

    setBusyId(row.id);
    setErr(null);
    try {
      const result = await enableSavedSearchNotify(row.id);
      setMsg(
        result.emailSent === false
          ? "Alertas activadas. El correo no pudo enviarse (revisa la configuración SMTP del servidor)."
          : "Alertas activadas. Revisa tu correo con los anuncios actuales.",
      );
      await load();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const onRename = async (row: SavedSearchDto) => {
    const next = window.prompt("Nuevo nombre para la búsqueda", row.label);
    if (next == null || !next.trim() || next.trim() === row.label) return;
    setBusyId(row.id);
    try {
      await updateSavedSearch(row.id, { label: next.trim() });
      await load();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (row: SavedSearchDto) => {
    if (!window.confirm(`¿Eliminar la búsqueda «${row.label}»?`)) return;
    setBusyId(row.id);
    try {
      await deleteSavedSearch(row.id);
      await load();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Mis Búsquedas</h1>
        <p className="mt-2 text-sm text-muted">Inicia sesión para ver tus búsquedas guardadas.</p>
        <Link to="/entrar" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Mis Búsquedas</h1>
          <p className="mt-2 text-sm text-muted">
            Búsquedas guardadas desde el mapa. Puedes activar alertas por correo en una búsqueda a la vez.
          </p>
        </div>
        <Link
          to="/buscar"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
        >
          Buscar
        </Link>
      </div>

      {msg ? (
        <p className="mt-4 rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-body">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
      ) : null}

      <div className="mt-8 space-y-4">
        {rows === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">
            Aún no tienes búsquedas guardadas. Usa{" "}
            <strong className="text-body">Guardar búsqueda</strong> en el mapa de búsqueda.
          </p>
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-body">{row.label}</h2>
                  <p className="mt-1 text-xs text-muted">
                    Actualizada {new Date(row.updatedAt).toLocaleDateString("es-MX")}
                    {row.matchCount != null ? ` · ${row.matchCount} anuncio${row.matchCount === 1 ? "" : "s"} ahora` : ""}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.emailNotifyEnabled}
                    disabled={busyId === row.id || !me.email}
                    onChange={(ev) => void onToggleNotify(row, ev.target.checked)}
                  />
                  <span className="text-body">Alertas por correo</span>
                </label>
              </div>

              {!me.email ? (
                <p className="mt-2 text-xs text-muted">
                  <Link to="/perfil/editar" className="font-semibold text-primary underline">
                    Agrega un correo
                  </Link>{" "}
                  para activar alertas.
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(row.searchUrl)}
                  className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-fg hover:brightness-110"
                >
                  Abrir búsqueda
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void onRename(row)}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-body hover:bg-surface-elevated disabled:opacity-50"
                >
                  Renombrar
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void onDelete(row)}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-error hover:bg-red-50 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
