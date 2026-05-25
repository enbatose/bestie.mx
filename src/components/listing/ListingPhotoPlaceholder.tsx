import { Camera } from "lucide-react";

export function ListingPhotoPlaceholder() {
  return (
    <div
      className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-light px-6 py-10 text-center sm:aspect-[2/1]"
      role="img"
      aria-label="Sin fotos disponibles"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-surface ring-1 ring-border">
        <Camera className="size-7 text-muted" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-body">Aún no hay fotos de este espacio</p>
        <p className="text-sm leading-relaxed text-muted">
          Pide fotos recientes al contactar al anunciante antes de agendar una visita.
        </p>
      </div>
    </div>
  );
}
