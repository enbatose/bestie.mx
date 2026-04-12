import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { groupsCreate, groupsJoin, groupsMine, isAuthApiConfigured, type GroupRow } from "@/lib/authApi";

export function GroupsPage() {
  const apiOn = isAuthApiConfigured();
  const [rows, setRows] = useState<GroupRow[] | null>(null);
  const [name, setName] = useState("");
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [minIncomeMxn, setMinIncomeMxn] = useState<string>("");
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
        Organiza roomies compatibles (edad / ingreso mínimo opcional) para rentar una propiedad completa. Requiere
        sesión de publicador:{" "}
        <Link to="/publicar" className="font-medium text-primary underline-offset-2 hover:underline">
          Publicar
        </Link>{" "}
        o inicia sesión. Luego comparte el código de invitación por WhatsApp o Messenger.
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
            const minA = minAge.trim() === "" ? undefined : Number(minAge);
            const maxA = maxAge.trim() === "" ? undefined : Number(maxAge);
            const inc = minIncomeMxn.trim() === "" ? undefined : Number(minIncomeMxn);
            await groupsCreate({
              name: name.trim(),
              ...(Number.isFinite(minA) ? { minAge: minA } : {}),
              ...(Number.isFinite(maxA) ? { maxAge: maxA } : {}),
              ...(Number.isFinite(inc) ? { minIncomeMxn: inc } : {}),
            });
            setName("");
            setMinAge("");
            setMaxAge("");
            setMinIncomeMxn("");
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
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Edad mín.
            <input
              type="number"
              min={18}
              max={99}
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              placeholder="—"
              className="mt-0.5 w-full rounded-lg border border-border bg-bg-light px-2 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="text-xs text-muted">
            Edad máx.
            <input
              type="number"
              min={18}
              max={99}
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
              placeholder="—"
              className="mt-0.5 w-full rounded-lg border border-border bg-bg-light px-2 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
        </div>
        <label className="text-xs text-muted">
          Ingreso mínimo (MXN / mes, opcional)
          <input
            type="number"
            min={0}
            value={minIncomeMxn}
            onChange={(e) => setMinIncomeMxn(e.target.value)}
            placeholder="Ej. 15000"
            className="mt-0.5 w-full rounded-lg border border-border bg-bg-light px-2 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
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
                Código: <span className="font-mono text-body">{g.invite_code}</span> · {g.member_count} miembros
                {g.min_age != null || g.max_age != null ? (
                  <>
                    {" "}
                    · edad {g.min_age ?? "—"}–{g.max_age ?? "—"}
                  </>
                ) : null}
                {g.min_income_mxn != null ? <> · ingreso ≥ {g.min_income_mxn} MXN</> : null}
              </div>
              <p className="mt-2 text-xs text-muted">
                Comparte:{" "}
                <span className="select-all font-mono text-body">
                  Únete a “{g.name}” en Bestie con el código {g.invite_code}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
