type Props = {
  onEdit?: () => void;
  className?: string;
};

/** Prominent missing-rent warning used on wizard Step 6 (preview + publish bar). */
export function MissingRentCallout({ onEdit, className = "" }: Props) {
  return (
    <div
      className={`rounded-xl border-2 border-error/50 bg-error/10 px-4 py-3 text-error ${className}`.trim()}
      role="alert"
    >
      <p className="text-sm font-bold tracking-tight">Falta el precio de renta</p>
      <p className="mt-1 text-xs leading-snug">
        Indica cuánto cuesta al mes. No puedes publicar el anuncio en 0 MXN / mes.
      </p>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 text-xs font-semibold underline decoration-2 underline-offset-2 hover:opacity-80"
        >
          Agregar renta
        </button>
      ) : null}
    </div>
  );
}
