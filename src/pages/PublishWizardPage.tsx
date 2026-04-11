import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "bestie-publish-draft-v1";

const CITIES = [
  "Guadalajara",
  "Mérida",
  "Puerto Vallarta",
  "Sayulita",
  "Bucerías",
] as const;

type Draft = {
  city: (typeof CITIES)[number];
  title: string;
  rentMxn: number;
  rooms: number;
  note: string;
  status: "draft" | "published";
};

const defaultDraft = (): Draft => ({
  city: "Guadalajara",
  title: "",
  rentMxn: 5000,
  rooms: 1,
  note: "",
  status: "draft",
});

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDraft();
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return { ...defaultDraft(), ...parsed };
  } catch {
    return defaultDraft();
  }
}

export function PublishWizardPage() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => loadDraft());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const steps = useMemo(
    () => [
      {
        title: "Ubicación",
        body: (
          <label className="block text-sm font-medium text-body">
            Ciudad inicial
            <select
              value={draft.city}
              onChange={(e) =>
                setDraft((d) => ({ ...d, city: e.target.value as Draft["city"] }))
              }
              className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs text-muted">
              Más adelante: colonia, pin en mapa y validaciones legales.
            </span>
          </label>
        ),
      },
      {
        title: "Propiedad",
        body: (
          <label className="block text-sm font-medium text-body">
            Título del anuncio
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Ej. Cuarto cerca de Chapu / depa zona Minerva"
              className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
        ),
      },
      {
        title: "Cuartos y renta",
        body: (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-body">
              Cuartos disponibles
              <input
                type="number"
                min={1}
                max={12}
                value={draft.rooms}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, rooms: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Renta mensual (MXN)
              <input
                type="number"
                min={0}
                step={100}
                value={draft.rentMxn}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, rentMxn: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
          </div>
        ),
      },
      {
        title: "Detalles",
        body: (
          <label className="block text-sm font-medium text-body">
            Notas (reglas, muebles, mascotas…)
            <textarea
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              rows={5}
              className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
        ),
      },
      {
        title: "Estado",
        body: (
          <fieldset>
            <legend className="text-sm font-medium text-body">Estado del anuncio (v1)</legend>
            <div className="mt-3 space-y-2 text-sm text-body">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  checked={draft.status === "draft"}
                  onChange={() => setDraft((d) => ({ ...d, status: "draft" }))}
                />
                Borrador (autosave en tu navegador)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  checked={draft.status === "published"}
                  onChange={() => setDraft((d) => ({ ...d, status: "published" }))}
                />
                Publicado (simulado; aún no hay API)
              </label>
            </div>
          </fieldset>
        ),
      },
    ],
    [draft],
  );

  const current = steps[step]!;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Publicar</h1>
      <p className="mt-2 text-sm text-muted">
        Wizard mínimo con autosave local. En producción esto se completaría con fotos, pin en mapa
        y wizard legal como en el alcance Bestie v1.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Paso {step + 1} de {steps.length}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-body">{current.title}</h2>
        <div className="mt-4">{current.body}</div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition enabled:hover:bg-surface-elevated disabled:opacity-40"
          >
            Atrás
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition hover:brightness-110"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
              }}
              className="rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-primary transition hover:brightness-95"
            >
              Guardar borrador
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Ver búsqueda de muestra
        </Link>
      </p>
    </div>
  );
}
