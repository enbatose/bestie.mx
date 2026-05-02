import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchPropertyWithRooms } from "@/lib/listingsApi";
import type { PropertyWithRooms } from "@/types/listing";

export function PropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [propertyPack, setPropertyPack] = useState<PropertyWithRooms | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setPropertyPack(null);
      return;
    }
    const ac = new AbortController();
    setPropertyPack(undefined);
    setErr(null);
    fetchPropertyWithRooms(id, ac.signal)
      .then((pack) => setPropertyPack(pack))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setPropertyPack(null);
        setErr("No se pudo cargar la propiedad.");
      });
    return () => ac.abort();
  }, [id]);

  useEffect(() => {
    if (!propertyPack) return;
    const firstPublishedRoom = propertyPack.rooms.find((room) => room.status === "published");
    if (firstPublishedRoom) {
      navigate(`/anuncio/${encodeURIComponent(firstPublishedRoom.id)}`, { replace: true });
    }
  }, [navigate, propertyPack]);

  if (propertyPack === undefined && !err) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted">Cargando propiedad…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold text-body">No es posible abrir esta propiedad</h1>
      <p className="mt-2 text-sm text-muted">
        {err ??
          "La propiedad no está disponible públicamente o no tiene cuartos publicados en este momento."}
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
