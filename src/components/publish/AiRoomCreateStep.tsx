import { useEffect, useState } from "react";
import { CITY_ANCHOR } from "@/lib/publishWizard/publishCore";
import { AiImageDropZone, type AiLocalImage } from "@/components/publish/AiImageDropZone";
import {
  PublishAiFilterChips,
  type PublishAiHintState,
} from "@/components/publish/PublishAiFilterChips";

type Props = {
  city: string;
  onCityChange: (city: string) => void;
  text: string;
  onTextChange: (text: string) => void;
  hints: PublishAiHintState;
  onHintsChange: (hints: PublishAiHintState) => void;
  photos: AiLocalImage[];
  onPhotosChange: (images: AiLocalImage[]) => void;
  infographics: AiLocalImage[];
  onInfographicsChange: (images: AiLocalImage[]) => void;
  onFillManually: () => void;
  variant?: "room" | "property";
};

export function AiRoomCreateStep({
  city,
  onCityChange,
  text,
  onTextChange,
  hints,
  onHintsChange,
  photos,
  onPhotosChange,
  infographics,
  onInfographicsChange,
  onFillManually,
  variant = "room",
}: Props) {
  const [infographicOpen, setInfographicOpen] = useState(infographics.length > 0);

  useEffect(() => {
    if (infographics.length > 0) setInfographicOpen(true);
  }, [infographics.length]);

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Ciudad
          </span>
          <select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="h-11 w-full max-w-xs rounded-xl border border-border bg-surface px-3 text-base text-body focus:border-accent focus:outline-none sm:text-sm"
          >
            {(Object.keys(CITY_ANCHOR) as Array<keyof typeof CITY_ANCHOR>).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-2">
        <label className="block text-sm font-semibold text-body" htmlFor="ai-room-source-text">
          Texto de tu publicación
        </label>
        <p className="text-xs text-muted">
          {variant === "property"
            ? "Pega aquí el texto de Facebook o describe la casa y las recámaras. La IA arma la propiedad y deja las recámaras listas para verificar."
            : "Pega aquí el texto de Facebook o describe el cuarto. La IA arma el anuncio con esto."}
        </p>
        <textarea
          id="ai-room-source-text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Pega aquí el texto de tu publicación de Facebook…"
          rows={7}
          className="min-h-[9rem] w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-body placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
        />
      </div>

      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm">
        <PublishAiFilterChips hints={hints} onChange={onHintsChange} variant={variant} />
      </div>

      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-3">
        <AiImageDropZone
          images={photos}
          onImages={onPhotosChange}
          maxCount={20}
          showCamera
          label={variant === "property" ? "Fotos de la propiedad y recámaras" : "Fotos de tu espacio"}
          hint={
            variant === "property"
              ? "Súbelas todas juntas. Quedan en áreas compartidas; en Verificar puedes pasarlas a cada recámara. No las lee la IA."
              : "Estas fotos se publican en el anuncio. No las lee la IA. Pega, arrastra, elige archivo o toma una foto."
          }
        />
      </div>

      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-3">
        {!infographicOpen && infographics.length === 0 ? (
          <button
            type="button"
            onClick={() => setInfographicOpen(true)}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            ¿Tienes un infográfico, poster o captura del mapa?
          </button>
        ) : (
          <AiImageDropZone
            images={infographics}
            onImages={(next) => {
              onInfographicsChange(next);
              if (next.length === 0) setInfographicOpen(true);
            }}
            maxCount={2}
            label="Infográfico, poster o mapa"
            hint="Máximo 2 archivos. Solo estas imágenes las lee la IA (precios, colonia, mapa). También se publican como fotos; puedes quitarlas en la vista previa."
          />
        )}
      </div>

      <p className="text-center text-sm text-muted">
        <button
          type="button"
          onClick={onFillManually}
          className="inline-flex min-h-11 items-center px-2 font-semibold text-primary underline-offset-2 hover:underline"
        >
          Prefiero llenar los datos a mano (Sin IA)
        </button>
      </p>
    </form>
  );
}
