import { useRef, useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { authUpdateMe } from "@/lib/authApi";
import { uploadListingImage } from "@/lib/listingsApi";
import { prepareListingImage } from "@/lib/prepareListingImage";
import { persistPickedFile } from "@/lib/persistPickedFile";

type Props = {
  displayName: string;
  profilePictureUrl?: string | null;
  onUpdated: (profilePictureUrl: string | null) => void;
  /** When false, only uploads; does not PATCH /me (phone register). */
  saveToAccount?: boolean;
  compact?: boolean;
};

export function ProfilePictureUpload({
  displayName,
  profilePictureUrl,
  onUpdated,
  saveToAccount = true,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const durable = await persistPickedFile(file);
      if (inputRef.current) inputRef.current.value = "";
      const prepared = await prepareListingImage(durable);
      const url = await uploadListingImage(prepared.outFile);
      if (saveToAccount) {
        await authUpdateMe({ profilePictureUrl: url });
        window.dispatchEvent(new Event("bestie:me-changed"));
        setMsg("Foto de perfil actualizada.");
      }
      onUpdated(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (saveToAccount) {
        await authUpdateMe({ profilePictureUrl: null });
        window.dispatchEvent(new Event("bestie:me-changed"));
        setMsg("Foto de perfil eliminada.");
      }
      onUpdated(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo quitar la foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "flex min-w-0 items-center gap-3"
          : "flex flex-col items-start gap-4 sm:flex-row sm:items-center"
      }
    >
      <UserAvatar displayName={displayName} profilePictureUrl={profilePictureUrl} size={compact ? "md" : "lg"} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-body">Foto de perfil {compact ? "(opcional)" : ""}</p>
        {compact ? null : <p className="mt-1 text-xs text-muted">JPG, PNG o WebP. Máximo 5 MB.</p>}
        <div className={`flex flex-wrap gap-2 ${compact ? "mt-1" : "mt-3"}`}>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
          >
            {busy ? "Subiendo…" : profilePictureUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {profilePictureUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRemove()}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-elevated disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
            >
              Quitar
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
        {msg ? <p className="mt-2 text-xs text-body">{msg}</p> : null}
        {err ? <p className="mt-2 text-xs text-error">{err}</p> : null}
      </div>
    </div>
  );
}
