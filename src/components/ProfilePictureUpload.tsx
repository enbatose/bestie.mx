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
};

export function ProfilePictureUpload({ displayName, profilePictureUrl, onUpdated }: Props) {
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
      await authUpdateMe({ profilePictureUrl: url });
      onUpdated(url);
      window.dispatchEvent(new Event("bestie:me-changed"));
      setMsg("Foto de perfil actualizada.");
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
      await authUpdateMe({ profilePictureUrl: null });
      onUpdated(null);
      window.dispatchEvent(new Event("bestie:me-changed"));
      setMsg("Foto de perfil eliminada.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo quitar la foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <UserAvatar displayName={displayName} profilePictureUrl={profilePictureUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-body">Foto de perfil</p>
        <p className="mt-1 text-xs text-muted">JPG, PNG o WebP. Máximo 5 MB.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated disabled:opacity-60"
          >
            {busy ? "Guardando…" : profilePictureUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {profilePictureUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRemove()}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-surface-elevated disabled:opacity-60"
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
