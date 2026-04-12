import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createListing, isListingsApiConfigured } from "@/lib/listingsApi";
import type { ListingTag } from "@/types/listing";

const STORAGE_KEY = "bestie-publish-draft-v1";

const CITIES = [
  "Guadalajara",
  "Mérida",
  "Puerto Vallarta",
  "Sayulita",
  "Bucerías",
] as const;

/** Default map pin per city (MVP until map picker exists). */
const CITY_ANCHOR: Record<
  (typeof CITIES)[number],
  { neighborhood: string; lat: number; lng: number }
> = {
  Guadalajara: { neighborhood: "Zona metropolitana", lat: 20.675_138, lng: -103.347_345 },
  Mérida: { neighborhood: "Centro", lat: 20.967_37, lng: -89.592_586 },
  "Puerto Vallarta": { neighborhood: "Zona hotelera", lat: 20.653_4, lng: -105.225_331 },
  Sayulita: { neighborhood: "Centro", lat: 20.870_789, lng: -105.440_849 },
  Bucerías: { neighborhood: "Centro", lat: 20.755_056, lng: -105.333_056 },
};

type Draft = {
  city: (typeof CITIES)[number];
  title: string;
  neighborhood: string;
  contactWhatsApp: string;
  rentMxn: number;
  rooms: number;
  note: string;
  status: "draft" | "published";
};

const defaultDraft = (): Draft => ({
  city: "Guadalajara",
  title: "",
  neighborhood: "",
  contactWhatsApp: "",
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

function normalizeWhatsApp(s: string): string {
  return s.replace(/\D/g, "");
}

export function PublishWizardPage() {
  const navigate = useNavigate();
  const apiOn = isListingsApiConfigured();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishErr, setPublishErr] = useState<string | null>(null);

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
          <div className="grid gap-4">
            <label className="block text-sm font-medium text-body">
              Título del anuncio
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Ej. Cuarto cerca de Chapu / depa zona Minerva"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Colonia o zona
              <input
                value={draft.neighborhood}
                onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))}
                placeholder="Ej. Chapultepec, Versalles…"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            {apiOn ? (
              <label className="block text-sm font-medium text-body">
                WhatsApp (solo números, se guarda en el anuncio)
                <input
                  value={draft.contactWhatsApp}
                  onChange={(e) => setDraft((d) => ({ ...d, contactWhatsApp: e.target.value }))}
                  placeholder="Ej. 523312345678"
                  inputMode="tel"
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
              </label>
            ) : null}
          </div>
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
                Publicado
                {apiOn ? " (se envía al servidor)" : " (simulado; sin VITE_API_URL)"}
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
        {publishErr ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {publishErr}
          </p>
        ) : null}

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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
                }}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
              >
                Guardar borrador
              </button>
              {apiOn && draft.status === "published" ? (
                <button
                  type="button"
                  disabled={publishBusy}
                  onClick={async () => {
                    setPublishErr(null);
                    const anchor = CITY_ANCHOR[draft.city];
                    const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
                    const digits = normalizeWhatsApp(draft.contactWhatsApp);
                    if (!draft.title.trim()) {
                      setPublishErr("Agrega un título.");
                      return;
                    }
                    if (digits.length < 10) {
                      setPublishErr("Agrega un WhatsApp válido (al menos 10 dígitos).");
                      return;
                    }
                    setPublishBusy(true);
                    try {
                      const tags: ListingTag[] = [];
                      const created = await createListing({
                        title: draft.title.trim(),
                        city: draft.city,
                        neighborhood,
                        lat: anchor.lat,
                        lng: anchor.lng,
                        rentMxn: draft.rentMxn,
                        roomsAvailable: draft.rooms,
                        tags,
                        roommateGenderPref: "any",
                        ageMin: 18,
                        ageMax: 99,
                        summary: draft.note.trim() || draft.title.trim(),
                        contactWhatsApp: digits,
                      });
                      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, status: "draft" }));
                      navigate(`/anuncio/${created.id}`);
                    } catch (e) {
                      setPublishErr(e instanceof Error ? e.message : "No se pudo publicar.");
                    } finally {
                      setPublishBusy(false);
                    }
                  }}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
                >
                  {publishBusy ? "Publicando…" : "Publicar en línea"}
                </button>
              ) : null}
            </div>
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
