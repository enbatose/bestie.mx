import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getListingById, SEED_LISTINGS } from "@/data/seedListings";
import {
  fetchListingByIdFromApi,
  fetchPropertyWithRooms,
  isListingsApiConfigured,
} from "@/lib/listingsApi";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { PropertyListing, PropertyWithRooms } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function ListingPage() {
  const { id } = useParams();
  const apiOn = isListingsApiConfigured();
  const seedListing = useMemo(() => (id ? getListingById(id) : undefined), [id]);

  const [apiListing, setApiListing] = useState<PropertyListing | null | undefined>(() =>
    apiOn ? undefined : null,
  );
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [propertyPack, setPropertyPack] = useState<PropertyWithRooms | null | undefined>(() =>
    apiOn ? undefined : null,
  );
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [id]);

  useEffect(() => {
    if (!apiOn || !id) {
      setApiListing(apiOn ? undefined : null);
      setApiErr(null);
      return;
    }
    const ac = new AbortController();
    setApiListing(undefined);
    setApiErr(null);
    fetchListingByIdFromApi(id, ac.signal)
      .then((l) => {
        setApiListing(l);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setApiErr("No se pudo cargar el anuncio.");
        setApiListing(null);
      });
    return () => ac.abort();
  }, [apiOn, id]);

  const listing = apiOn ? (apiListing === undefined ? undefined : apiListing) : seedListing;

  useEffect(() => {
    if (!apiOn || !listing?.propertyId) {
      setPropertyPack(null);
      return;
    }
    const ac = new AbortController();
    setPropertyPack(undefined);
    fetchPropertyWithRooms(listing.propertyId, ac.signal)
      .then((p) => setPropertyPack(p))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setPropertyPack(null);
      });
    return () => ac.abort();
  }, [apiOn, listing?.propertyId]);

  const seedSiblings = useMemo(() => {
    if (!listing?.propertyId) return [];
    return SEED_LISTINGS.filter((l) => l.propertyId === listing.propertyId && l.id !== listing.id);
  }, [listing]);

  const galleryUrls = useMemo(() => {
    if (!listing) return [];
    const fromJoin = [...(listing.propertyImageUrls ?? []), ...(listing.roomImageUrls ?? [])];
    if (fromJoin.length) return fromJoin;
    if (!apiOn || !propertyPack) return [];
    const room = propertyPack.rooms.find((r) => r.id === listing.id);
    return [...(propertyPack.property.imageUrls ?? []), ...(room?.imageUrls ?? [])];
  }, [apiOn, listing, propertyPack]);

  const siblingLinks = useMemo(() => {
    if (apiOn && propertyPack && propertyPack.rooms.length > 1) {
      return propertyPack.rooms
        .filter((r) => r.id !== listing?.id && r.status === "published")
        .map((r) => ({ id: r.id, label: r.title }));
    }
    return seedSiblings.map((l) => ({ id: l.id, label: l.title }));
  }, [apiOn, propertyPack, listing?.id, seedSiblings]);

  if (apiOn && apiListing === undefined && !apiErr) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted">Cargando anuncio…</p>
      </div>
    );
  }

  if (apiErr) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-xl font-semibold text-body">Error</h1>
        <p className="mt-2 text-sm text-muted">{apiErr}</p>
        <Link
          to="/buscar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
        >
          Volver a buscar
        </Link>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-xl font-semibold text-body">Anuncio no encontrado</h1>
        <p className="mt-2 text-sm text-muted">
          El anuncio no existe o ya no está publicado.
        </p>
        <Link
          to="/buscar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
        >
          Volver a buscar
        </Link>
      </div>
    );
  }

  const wa = `https://wa.me/${listing.contactWhatsApp.replace(/\D/g, "")}`;
  const listingStatus = listing.status ?? "published";
  const showWhatsApp = listing.showWhatsApp !== false;
  const depositMxn = listing.depositMxn ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="text-sm text-muted">
        <Link to="/buscar" className="font-medium text-primary underline-offset-2 hover:underline">
          Buscar
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="text-body">{listing.title}</span>
      </nav>

      <header className="mt-6">
        <p className="text-sm text-muted">
          {listing.neighborhood} · {listing.city}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{listing.title}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
              listingStatus === "published"
                ? "bg-secondary/25 text-primary"
                : listingStatus === "paused"
                  ? "bg-amber-100 text-amber-900"
                  : listingStatus === "draft"
                    ? "bg-slate-200 text-slate-800"
                    : "bg-slate-200 text-slate-600"
            }`}
          >
            {listingStatus === "published"
              ? "Publicado"
              : listingStatus === "paused"
                ? "Pausado"
                : listingStatus === "draft"
                  ? "Borrador"
                  : "Archivado"}
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold text-body">{money.format(listing.rentMxn)}</p>
        {depositMxn > 0 ? (
          <p className="mt-1 text-sm text-muted">Depósito · {money.format(depositMxn)}</p>
        ) : null}
        {apiOn && propertyPack ? (
          <p className="mt-1 text-sm text-muted">
            Propiedad · {propertyPack.property.bedroomsTotal} recámara(s) · {propertyPack.property.bathrooms}{" "}
            baño(s)
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted">
          {listing.roomsAvailable} cuarto(s) disponible(s) · Roomies{" "}
          {listing.roommateGenderPref === "any"
            ? "sin preferencia declarada"
            : `prefieren ${listing.roommateGenderPref === "female" ? "mujer" : "hombre"}`}{" "}
          · Edad anuncio {listing.ageMin}–{listing.ageMax}
        </p>
        <p className="mt-2 text-xs text-muted">
          Anuncio (cuarto) <span className="font-mono">{listing.id}</span> · Propiedad{" "}
          <span className="font-mono">{listing.propertyId}</span>
        </p>
      </header>

      {galleryUrls.length ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-body">Fotos</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {galleryUrls.map((u) => (
              <a
                key={u}
                href={apiAbsoluteUrl(u)}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl ring-1 ring-border transition hover:opacity-90"
              >
                <img src={apiAbsoluteUrl(u)} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {siblingLinks.length ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-body">Otros cuartos en la misma propiedad</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {siblingLinks.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/anuncio/${s.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {apiOn && propertyPack?.property.summary.trim() ? (
        <section className="mt-6 rounded-2xl border border-border bg-bg-light p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-body">Sobre la propiedad</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
            {propertyPack.property.summary}
          </p>
        </section>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-body">Descripción del cuarto</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{listing.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {listing.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-bg-light px-3 py-1 text-xs font-medium text-body ring-1 ring-border"
            >
              {TAG_LABELS[t]}
            </span>
          ))}
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-bg-light p-5 sm:p-6">
        <h2 className="text-base font-semibold text-body">Contacto (v1)</h2>
        {!showWhatsApp ? (
          <p className="mt-2 text-sm text-muted">
            El anunciante eligió no mostrar WhatsApp en Bestie. Puedes escribir a{" "}
            <a href="mailto:support@bestie.mx" className="font-medium text-primary underline-offset-2 hover:underline">
              support@bestie.mx
            </a>{" "}
            si necesitas ayuda para contactar (misma idea que “no visible” en Roomix).
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Sin chat en la app por ahora: revela WhatsApp cuando estés listo.
            </p>
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-4 inline-flex rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:brightness-95"
              >
                Revelar WhatsApp
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-body">
                  <span className="font-medium">Número:</span> +{listing.contactWhatsApp}
                </p>
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
                >
                  Abrir WhatsApp
                </a>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
