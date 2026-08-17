type Props = {
  onEdit?: () => void;
  className?: string;
};

/** Prominent missing-rent warning used on wizard Step 6 (preview + publish bar). */
export function MissingRentCallout({ onEdit, className = "" }: Props) {
  const boxClass =
    `rounded-xl border-2 border-error/50 bg-error/10 px-4 py-3 text-error ${className}`.trim();
  const body = (
    <>
      <span className="block text-sm font-bold tracking-tight">Falta el precio de renta</span>
      <span className="mt-1 block text-xs leading-snug">
        Indica cuánto cuesta al mes. No puedes publicar el anuncio en 0 MXN / mes.
      </span>
    </>
  );

  if (onEdit) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className={`${boxClass} w-full text-left transition hover:bg-error/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error`}
      >
        {body}
        <span className="mt-2 block text-xs font-semibold underline decoration-2 underline-offset-2">
          Agregar renta
        </span>
      </button>
    );
  }

  return (
    <div className={boxClass} role="alert">
      {body}
    </div>
  );
}
