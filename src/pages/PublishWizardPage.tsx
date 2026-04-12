import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addDraftRoomToProperty,
  createDraftProperty,
  isListingsApiConfigured,
  publishPropertyBundle,
} from "@/lib/listingsApi";
import { TAG_LABELS } from "@/lib/searchFilters";
import type {
  ListingTag,
  LodgingType,
  PropertyKind,
  RoommateGenderPref,
} from "@/types/listing";

const ALL_TAGS = Object.keys(TAG_LABELS) as ListingTag[];

const STORAGE_KEY = "bestie-publish-draft-v2";

const CITIES = [
  "Guadalajara",
  "Mérida",
  "Puerto Vallarta",
  "Sayulita",
  "Bucerías",
] as const;

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

type RoomDraft = {
  title: string;
  rentMxn: number;
  roomsAvailable: number;
  summary: string;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  lodgingType: LodgingType;
};

type Draft = {
  city: (typeof CITIES)[number];
  propertyTitle: string;
  neighborhood: string;
  contactWhatsApp: string;
  propertySummary: string;
  propertyKind: PropertyKind;
  useCustomMapPin: boolean;
  customLat: string;
  customLng: string;
  rooms: RoomDraft[];
  legalAccepted: boolean;
};

const defaultRoom = (): RoomDraft => ({
  title: "Cuarto disponible",
  rentMxn: 5000,
  roomsAvailable: 1,
  summary: "",
  tags: [],
  roommateGenderPref: "any",
  ageMin: 18,
  ageMax: 99,
  lodgingType: "private_room",
});

const defaultDraft = (): Draft => ({
  city: "Guadalajara",
  propertyTitle: "",
  neighborhood: "",
  contactWhatsApp: "",
  propertySummary: "",
  propertyKind: "house",
  useCustomMapPin: false,
  customLat: "",
  customLng: "",
  rooms: [defaultRoom()],
  legalAccepted: false,
});

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDraft();
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const baseRooms = Array.isArray(parsed.rooms) && parsed.rooms.length ? parsed.rooms : [defaultRoom()];
    const rooms = baseRooms.map((r) => ({ ...defaultRoom(), ...r }));
    const pk =
      parsed.propertyKind === "apartment" || parsed.propertyKind === "house"
        ? parsed.propertyKind
        : defaultDraft().propertyKind;
    return {
      ...defaultDraft(),
      ...parsed,
      propertyKind: pk,
      useCustomMapPin: Boolean(parsed.useCustomMapPin),
      customLat: typeof parsed.customLat === "string" ? parsed.customLat : "",
      customLng: typeof parsed.customLng === "string" ? parsed.customLng : "",
      rooms,
    };
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
  const [submitInFlight, setSubmitInFlight] = useState<"publish" | "draft" | null>(null);
  const [publishErr, setPublishErr] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  function updateRoom(i: number, patch: Partial<RoomDraft>) {
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  }

  function addRoom() {
    setDraft((d) => ({ ...d, rooms: [...d.rooms, defaultRoom()] }));
  }

  function removeRoom(i: number) {
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.length <= 1 ? d.rooms : d.rooms.filter((_, j) => j !== i),
    }));
  }

  const steps = useMemo(
    () => [
      {
        title: "Ubicación",
        body: (
          <div>
            <label className="block text-sm font-medium text-body">
              Ciudad
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
                La propiedad y todos los cuartos comparten esta ciudad. El pin del mapa usa la zona por
                defecto de la ciudad salvo que indiques coordenadas.
              </span>
            </label>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-body">
              <input
                type="checkbox"
                checked={draft.useCustomMapPin}
                onChange={(e) => setDraft((d) => ({ ...d, useCustomMapPin: e.target.checked }))}
                className="mt-1 size-4 rounded border-border text-primary"
              />
              <span>Usar latitud / longitud personalizadas (pin en mapa)</span>
            </label>
            {draft.useCustomMapPin ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-body">
                  Latitud
                  <input
                    value={draft.customLat}
                    onChange={(e) => setDraft((d) => ({ ...d, customLat: e.target.value }))}
                    placeholder={String(CITY_ANCHOR[draft.city].lat)}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                  />
                </label>
                <label className="block text-sm font-medium text-body">
                  Longitud
                  <input
                    value={draft.customLng}
                    onChange={(e) => setDraft((d) => ({ ...d, customLng: e.target.value }))}
                    placeholder={String(CITY_ANCHOR[draft.city].lng)}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: "Propiedad",
        body: (
          <div className="grid gap-4">
            <label className="block text-sm font-medium text-body">
              Nombre de la propiedad
              <input
                value={draft.propertyTitle}
                onChange={(e) => setDraft((d) => ({ ...d, propertyTitle: e.target.value }))}
                placeholder="Ej. Casa compartida Chapalita / Depa zona Minerva"
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
            <label className="block text-sm font-medium text-body">
              Resumen de la propiedad (opcional)
              <textarea
                value={draft.propertySummary}
                onChange={(e) => setDraft((d) => ({ ...d, propertySummary: e.target.value }))}
                rows={3}
                placeholder="Reglas de la casa, áreas comunes, estacionamiento…"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Tipo de vivienda
              <select
                value={draft.propertyKind}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, propertyKind: e.target.value as PropertyKind }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              >
                <option value="house">Casa</option>
                <option value="apartment">Departamento</option>
              </select>
            </label>
            {apiOn ? (
              <label className="block text-sm font-medium text-body">
                WhatsApp de contacto (se muestra en cada cuarto)
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
        title: "Cuartos",
        body: (
          <div className="space-y-6">
            {draft.rooms.map((room, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-bg-light p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Cuarto {i + 1}
                  </p>
                  {draft.rooms.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRoom(i)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
                <label className="mt-3 block text-sm font-medium text-body">
                  Título del espacio
                  <input
                    value={room.title}
                    onChange={(e) => updateRoom(i, { title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-body">
                    Renta (MXN / mes)
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={room.rentMxn}
                      onChange={(e) =>
                        updateRoom(i, { rentMxn: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Plazas / espacios
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={room.roomsAvailable}
                      onChange={(e) =>
                        updateRoom(i, {
                          roomsAvailable: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-medium text-body">
                  Descripción del cuarto
                  <textarea
                    value={room.summary}
                    onChange={(e) => updateRoom(i, { summary: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <fieldset className="mt-3">
                  <legend className="text-sm font-medium text-body">Etiquetas del cuarto</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALL_TAGS.map((tag) => (
                      <label
                        key={tag}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-body"
                      >
                        <input
                          type="checkbox"
                          checked={room.tags.includes(tag)}
                          onChange={() =>
                            setDraft((d) => ({
                              ...d,
                              rooms: d.rooms.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      tags: r.tags.includes(tag)
                                        ? r.tags.filter((t) => t !== tag)
                                        : [...r.tags, tag],
                                    }
                                  : r,
                              ),
                            }))
                          }
                          className="size-3.5 rounded border-border text-primary"
                        />
                        {TAG_LABELS[tag]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-body">
                    Tipo de espacio
                    <select
                      value={room.lodgingType}
                      onChange={(e) =>
                        updateRoom(i, { lodgingType: e.target.value as LodgingType })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="private_room">Cuarto privado</option>
                      <option value="shared_room">Cuarto compartido</option>
                      <option value="whole_home">Vivienda completa</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Roomies prefieren
                    <select
                      value={room.roommateGenderPref}
                      onChange={(e) =>
                        updateRoom(i, {
                          roommateGenderPref: e.target.value as RoommateGenderPref,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="any">Sin preferencia</option>
                      <option value="female">Mujer</option>
                      <option value="male">Hombre</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-body">
                    Edad mín.
                    <input
                      type="number"
                      min={18}
                      max={99}
                      value={room.ageMin}
                      onChange={(e) =>
                        updateRoom(i, {
                          ageMin: Math.min(99, Math.max(18, Number(e.target.value) || 18)),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Edad máx.
                    <input
                      type="number"
                      min={18}
                      max={99}
                      value={room.ageMax}
                      onChange={(e) =>
                        updateRoom(i, {
                          ageMax: Math.min(99, Math.max(18, Number(e.target.value) || 99)),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addRoom}
              className="w-full rounded-xl border border-dashed border-secondary/60 py-2 text-sm font-semibold text-primary hover:bg-secondary/10"
            >
              + Agregar otro cuarto
            </button>
          </div>
        ),
      },
      {
        title: "Fotos",
        body: (
          <p className="text-sm text-muted">
            Aquí irá la carga de fotos por cuarto y áreas comunes. Por ahora es un paso informativo
            (stub) — en v1 se conectará al mismo modelo propiedad + cuartos.
          </p>
        ),
      },
      {
        title: "Publicar",
        body: (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-body">
              <input
                type="checkbox"
                checked={draft.legalAccepted}
                onChange={(e) => setDraft((d) => ({ ...d, legalAccepted: e.target.checked }))}
                className="mt-1 size-4 rounded border-border text-primary"
              />
              <span>
                Confirmo que la información es verídica y acepto las responsabilidades legales al
                publicar en Bestie (v1).
              </span>
            </label>
            {!apiOn ? (
              <p className="text-sm text-muted">
                Sin <code className="rounded bg-surface-elevated px-1 text-xs">VITE_API_URL</code>{" "}
                el borrador solo se guarda en tu navegador.
              </p>
            ) : null}
          </div>
        ),
      },
    ],
    [draft, apiOn],
  );

  const current = steps[step]!;

  function resolveLatLng(d: Draft): { lat: number; lng: number } {
    const anchor = CITY_ANCHOR[d.city];
    if (!d.useCustomMapPin) return { lat: anchor.lat, lng: anchor.lng };
    const lat = Number(String(d.customLat).replace(",", "."));
    const lng = Number(String(d.customLng).replace(",", "."));
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return { lat: anchor.lat, lng: anchor.lng };
  }

  function validateRoomsForSubmit(): string | null {
    for (const r of draft.rooms) {
      if (!r.title.trim() || !r.summary.trim()) {
        return "Cada cuarto necesita título y descripción.";
      }
      if (r.ageMin > r.ageMax) {
        return "En cada cuarto la edad mínima no puede ser mayor que la máxima.";
      }
    }
    return null;
  }

  async function submitPublish() {
    setPublishErr(null);
    const anchor = CITY_ANCHOR[draft.city];
    const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
    const digits = normalizeWhatsApp(draft.contactWhatsApp);
    if (!draft.propertyTitle.trim()) {
      setPublishErr("Agrega el nombre de la propiedad.");
      return;
    }
    if (digits.length < 10) {
      setPublishErr("Agrega un WhatsApp válido (al menos 10 dígitos).");
      return;
    }
    if (!draft.legalAccepted) {
      setPublishErr("Debes aceptar la confirmación legal.");
      return;
    }
    const roomErr = validateRoomsForSubmit();
    if (roomErr) {
      setPublishErr(roomErr);
      return;
    }

    setSubmitInFlight("publish");
    try {
      const { lat, lng } = resolveLatLng(draft);
      const res = await publishPropertyBundle({
        legalAccepted: true,
        property: {
          title: draft.propertyTitle.trim(),
          city: draft.city,
          neighborhood,
          lat,
          lng,
          summary: draft.propertySummary.trim(),
          contactWhatsApp: digits,
          propertyKind: draft.propertyKind,
        },
        rooms: draft.rooms.map((r) => ({
          title: r.title.trim(),
          rentMxn: r.rentMxn,
          roomsAvailable: r.roomsAvailable,
          tags: r.tags,
          roommateGenderPref: r.roommateGenderPref,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          summary: r.summary.trim(),
          lodgingType: r.lodgingType,
        })),
      });
      const first = res.rooms[0];
      if (!first) {
        setPublishErr("La API no devolvió cuartos.");
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultDraft(), city: draft.city }));
      navigate(`/anuncio/${first.id}`);
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo publicar.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  async function submitServerDraft() {
    setPublishErr(null);
    const anchor = CITY_ANCHOR[draft.city];
    const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
    const digits = normalizeWhatsApp(draft.contactWhatsApp);
    if (!draft.propertyTitle.trim()) {
      setPublishErr("Agrega el nombre de la propiedad.");
      return;
    }
    if (digits.length < 10) {
      setPublishErr("Agrega un WhatsApp válido (al menos 10 dígitos).");
      return;
    }
    const roomErr = validateRoomsForSubmit();
    if (roomErr) {
      setPublishErr(roomErr);
      return;
    }
    const { lat, lng } = resolveLatLng(draft);

    setSubmitInFlight("draft");
    try {
      const prop = await createDraftProperty({
        title: draft.propertyTitle.trim(),
        city: draft.city,
        neighborhood,
        lat,
        lng,
        summary: draft.propertySummary.trim(),
        contactWhatsApp: digits,
        propertyKind: draft.propertyKind,
      });
      for (const r of draft.rooms) {
        await addDraftRoomToProperty(prop.id, {
          title: r.title.trim(),
          rentMxn: r.rentMxn,
          roomsAvailable: r.roomsAvailable,
          tags: r.tags,
          roommateGenderPref: r.roommateGenderPref,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          summary: r.summary.trim(),
          lodgingType: r.lodgingType,
        });
      }
      navigate("/mis-anuncios", { state: { draftSaved: true } });
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo guardar el borrador en el servidor.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Publicar</h1>
      <p className="mt-2 text-sm text-muted">
        Modelo v1: una <strong className="font-medium text-body">propiedad</strong> y uno o más{" "}
        <strong className="font-medium text-body">cuartos</strong> con renta y descripción propias.
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
                onClick={() => localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
              >
                Guardar borrador
              </button>
              {apiOn ? (
                <button
                  type="button"
                  disabled={submitInFlight !== null}
                  onClick={() => void submitServerDraft()}
                  className="rounded-full border border-secondary/50 bg-secondary/10 px-5 py-2 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50"
                >
                  {submitInFlight === "draft" ? "Guardando…" : "Guardar borrador en servidor"}
                </button>
              ) : null}
              {apiOn ? (
                <button
                  type="button"
                  disabled={submitInFlight !== null}
                  onClick={() => void submitPublish()}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
                >
                  {submitInFlight === "publish" ? "Publicando…" : "Publicar"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Ver búsqueda
        </Link>
      </p>
    </div>
  );
}
