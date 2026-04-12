import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getListingById } from "@/data/seedListings";
import { fetchListingByIdFromApi, isListingsApiConfigured } from "@/lib/listingsApi";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { PropertyListing } from "@/types/listing";

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
  const [revealed, setRevealed] = useState(false);

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
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          {listing.title}
        </h1>
        <p className="mt-3 text-2xl font-semibold text-body">{money.format(listing.rentMxn)}</p>
        <p className="mt-1 text-sm text-muted">
          {listing.roomsAvailable} cuarto(s) disponible(s) · Roomies{" "}
          {listing.roommateGenderPref === "any"
            ? "sin preferencia declarada"
            : `prefieren ${listing.roommateGenderPref === "female" ? "mujer" : "hombre"}`}{" "}
          · Edad anuncio {listing.ageMin}–{listing.ageMax}
        </p>
      </header>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-body">Descripción</h2>
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
        <p className="mt-2 text-sm text-muted">
          Sin chat en la app por ahora: revela WhatsApp cuando estés listo (datos de muestra).
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
      </section>
    </div>
  );
}
