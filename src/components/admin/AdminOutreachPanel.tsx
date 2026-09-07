import { NavLink } from "react-router-dom";
import { AdminAssistedDraftPanel } from "@/components/admin/AdminAssistedDraftPanel";
import { AdminOutreachDiffusionPanel } from "@/components/admin/AdminOutreachDiffusionPanel";
import { AdminOutreachInvitationPanel } from "@/components/admin/AdminOutreachInvitationPanel";

export type OutreachTab = "creacion" | "difusion" | "invitacion";

export function AdminOutreachPanel({ tab }: { tab: OutreachTab }) {
  return (
    <div className="min-w-0">
      <div className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
        <NavLink
          to="/admin/outreach/creacion"
          className={({ isActive }) =>
            `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive ? "bg-primary text-primary-fg" : "border border-border text-body hover:bg-surface-elevated"
            }`
          }
        >
          Creación de posts
        </NavLink>
        <NavLink
          to="/admin/outreach/difusion"
          className={({ isActive }) =>
            `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive ? "bg-primary text-primary-fg" : "border border-border text-body hover:bg-surface-elevated"
            }`
          }
        >
          Difusión
        </NavLink>
        <NavLink
          to="/admin/outreach/invitacion"
          className={({ isActive }) =>
            `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive ? "bg-primary text-primary-fg" : "border border-border text-body hover:bg-surface-elevated"
            }`
          }
        >
          Invitación
        </NavLink>
      </div>
      <div className="mt-6">
        {tab === "difusion" ? (
          <AdminOutreachDiffusionPanel />
        ) : tab === "invitacion" ? (
          <AdminOutreachInvitationPanel />
        ) : (
          <AdminAssistedDraftPanel />
        )}
      </div>
    </div>
  );
}
