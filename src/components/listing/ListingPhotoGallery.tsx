import { apiAbsoluteUrl } from "@/lib/mediaUrl";

type Props = {
  urls: readonly string[];
  failedUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
  /** When set, photos link to full-size in a new tab. */
  linkToFullSize?: boolean;
};

/** Grid collage for wizard preview and cover selection. Published listings use {@link ListingPhotoCarousel}. */
export function ListingPhotoGallery({ urls, failedUrls, onImageError, linkToFullSize = false }: Props) {
  if (!urls.length) {
    return <p className="text-sm text-muted">Sin fotos disponibles.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((u, ix) => {
        const image = failedUrls?.has(u) ? (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl bg-bg-light px-4 text-center text-xs text-muted ring-1 ring-border">
            <span className="font-semibold text-body">Foto no disponible</span>
          </div>
        ) : (
          <img
            src={apiAbsoluteUrl(u)}
            alt=""
            className={`aspect-square w-full rounded-xl object-cover ring-1 ${
              ix === 0 ? "ring-primary" : "ring-border"
            }`}
            loading="lazy"
            onError={onImageError ? () => onImageError(u) : undefined}
          />
        );

        const wrapped = linkToFullSize ? (
          <a
            href={apiAbsoluteUrl(u)}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl transition hover:opacity-90"
          >
            {image}
          </a>
        ) : (
          image
        );

        return (
          <div key={u} className="relative">
            {wrapped}
            {ix === 0 ? (
              <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-fg">
                Portada
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
