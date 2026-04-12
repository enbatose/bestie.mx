import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { groupsCreate, groupsJoin, groupsMine, isAuthApiConfigured, type GroupRow } from "@/lib/authApi";

export function GroupsPage() {
  const apiOn = isAuthApiConfigured();
  const [rows, setRows] = useState<GroupRow[] | null>(null);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!apiOn) return;
    try {
      setRows(await groupsMine());
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
      setRows([]);
    }
  }, [apiOn]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!apiOn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold text-primary">Grupos</h1>
        <p className="mt-2 text-sm text-muted">Configura VITE_API_URL para usar grupos de roomies.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-primary">Grupos</h1>
      <p className="mt-2 text-sm text-muted">
        Crea un grupo para rentar un depa completo o únete con un código. Requiere sesión de publicador (visita{" "}
        <Link to="/publicar" className="font-medium text-primary underline-offset-2 hover:underline">
          Publicar
        </Link>{" "}
        o inicia sesión).
      </p>

      {err ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
      ) : null}

      <form
        className="mt-8 space-y-3 rounded-2xl border border-border bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setBusy(true);
          try {
            await groupsCreate({ name: name.trim() });
            setName("");
            await load();
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-sm font-semibold text-body">Nuevo grupo</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del grupo"
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
        >
          Crear
        </button>
      </form>

      <form
        className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setBusy(true);
          try {
            await groupsJoin(invite);
            setInvite("");
            await load();
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-sm font-semibold text-body">Unirse con código</h2>
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value.toUpperCase())}
          placeholder="Código de invitación"
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || invite.trim().length < 4}
          className="w-full rounded-full border border-border py-2 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-50"
        >
          Unirme
        </button>
      </form>

      <h2 className="mt-10 text-sm font-semibold text-body">Tus grupos</h2>
      {rows === null ? (
        <p className="mt-2 text-sm text-muted">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Aún no estás en ningún grupo.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((g) => (
            <li key={g.id} className="rounded-xl border border-border bg-bg-light px-4 py-3 text-sm">
              <div className="font-medium text-body">{g.name}</div>
              <div className="mt-1 text-xs text-muted">
                Código: <span className="font-mono text-body">{g.invite_code}</span> · {g.member_count}{" "}
                miembros
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
