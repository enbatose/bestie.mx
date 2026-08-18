import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminStartSupportConversation } from "@/lib/authApi";
import { adminSupportConversationPath } from "@/lib/adminSections";

type Props = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  /** Optional subject used only when a new support thread is created. */
  subject?: string;
  onError: (message: string | null) => void;
  className?: string;
};

export function AdminUserSupportLink({
  userId,
  displayName,
  email,
  subject,
  onError,
  className = "",
}: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const name = displayName?.trim() || "Usuario";
  const mail = email?.trim() || "";
  const label = mail ? `Abrir chat de soporte con ${name} (${mail})` : `Abrir chat de soporte con ${name}`;

  const openChat = async () => {
    if (busy) return;
    setBusy(true);
    onError(null);
    try {
      const { conversationId } = await adminStartSupportConversation({ userId, subject });
      navigate(adminSupportConversationPath(conversationId));
    } catch (x) {
      onError(x instanceof Error ? x.message : "No se pudo abrir el chat de soporte.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void openChat()}
      disabled={busy}
      aria-label={label}
      title="Abrir chat de soporte"
      className={`group/support max-w-full text-left disabled:opacity-60 ${className}`}
    >
      <span className="block font-medium text-primary underline-offset-2 group-hover/support:underline">
        {name}
      </span>
      {mail ? (
        <span className="ph-no-capture mt-0.5 block break-all text-xs text-muted underline-offset-2 group-hover/support:underline">
          {mail}
        </span>
      ) : null}
      {busy ? <span className="mt-0.5 block text-[10px] text-muted">Abriendo chat…</span> : null}
    </button>
  );
}
