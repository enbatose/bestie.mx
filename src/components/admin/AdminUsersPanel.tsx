import { useCallback, useEffect, useState } from "react";
import {
  adminListUsers,
  type AdminUserCounts,
  type AdminUserRow,
  type AdminUserSegment,
} from "@/lib/authApi";
import { AdminUserSupportLink } from "@/components/admin/AdminUserSupportLink";

const USER_SUBTABS: { id: AdminUserSegment; label: string }[] = [
  { id: "real", label: "Usuarios" },
  { id: "pending", label: "Pendientes" },
  { id: "staff", label: "Admin y sistema" },
  { id: "all", label: "Todos" },
];

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function roleBadge(role: AdminUserRow["role"]): { label: string; className: string } | null {
  if (role === "admin") {
    return { label: "Admin", className: "bg-primary/10 text-primary" };
  }
  if (role === "system") {
    return { label: "Sistema", className: "bg-bg-light text-muted ring-1 ring-border" };
  }
  return null;
}

type Props = {
  onError: (message: string | null) => void;
};

export function AdminUsersPanel({ onError }: Props) {
  const [segment, setSegment] = useState<AdminUserSegment>("real");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<AdminUserCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (next: AdminUserSegment) => {
      setLoading(true);
      try {
        const r = await adminListUsers({ limit: 200, segment: next });
        setUsers(r.users);
        setTotal(r.total);
        setCounts(r.counts);
        onError(null);
      } catch (x) {
        onError(x instanceof Error ? x.message : "No se pudo cargar usuarios.");
      } finally {
        setLoading(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    void load(segment);
  }, [load, segment]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro de usuarios">
        {USER_SUBTABS.map((t) => {
          const count = counts?.[t.id];
          const active = segment === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSegment(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-primary text-primary-fg"
                  : "border border-border text-body hover:bg-surface-elevated"
              }`}
            >
              {t.label}
              {count != null ? <span className="ml-1.5 tabular-nums opacity-80">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-muted">
        {segment === "real"
          ? "Cuentas verificadas, sin admin ni usuarios de sistema."
          : segment === "pending"
            ? "Cuentas que empezaron el registro y aún no validan el correo."
            : segment === "staff"
              ? "Administradores y cuentas de sistema (soporte y feedback)."
              : "Todas las cuentas de personas, sin admin ni sistema."}{" "}
        Total: {total} El nombre o el correo abre un chat de soporte.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Cargando…</p>
      ) : users.length === 0 ? (
        <p className="mt-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          No hay usuarios en esta lista.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
          {users.map((u) => {
            const pending = u.accountStatus === "pending_validation";
            const hasEmail = Boolean(u.email?.trim());
            const staff = roleBadge(u.role);
            return (
              <li key={u.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start gap-2">
                  {u.role === "system" ? (
                    <div className="font-medium text-body">{u.displayName}</div>
                  ) : (
                    <AdminUserSupportLink
                      userId={u.id}
                      displayName={u.displayName}
                      email={u.email}
                      onError={onError}
                    />
                  )}
                  {staff ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${staff.className}`}
                    >
                      {staff.label}
                    </span>
                  ) : hasEmail ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        pending
                          ? "bg-warning/15 text-warning-fg"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {pending ? "Pendiente" : "Verificado"}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-bg-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted ring-1 ring-border">
                      Sin correo
                    </span>
                  )}
                </div>
                {u.role === "system" ? (
                  <div className="ph-no-capture text-xs text-muted">
                    {u.email ?? "sin correo"} · tel …{u.phoneLast4 ?? "—"}
                    {pending || segment === "pending" ? ` · ${formatCreatedAt(u.createdAt)}` : ""}
                  </div>
                ) : (
                  <div className="text-xs text-muted">
                    tel …{u.phoneLast4 ?? "—"}
                    {pending || segment === "pending" ? ` · ${formatCreatedAt(u.createdAt)}` : ""}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
