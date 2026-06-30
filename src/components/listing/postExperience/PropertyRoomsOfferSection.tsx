import { Users } from "lucide-react";
import {
  genderPrefLabel,
  occupiedRoomOccupantLabel,
  roomDimensionWizardLabel,
  yesNo,
} from "@/lib/listingKeyLabels";
import { formatRoomAvailableFrom } from "@/lib/listingTags";
import type { Room } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type Props = {
  occupiedRooms: readonly Room[];
  availableRooms: readonly Room[];
  onOpenRoom: (room: Room) => void;
  onViewPropertyDetails: () => void;
};

export function PropertyRoomsOfferSection({
  occupiedRooms,
  availableRooms,
  onOpenRoom,
  onViewPropertyDetails,
}: Props) {
  return (
    <div className="space-y-6">
      {occupiedRooms.length ? (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Cuartos ocupados</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {occupiedRooms.map((room) => (
              <article key={room.id} className="rounded-xl border border-border bg-bg-light p-4">
                <p className="text-sm font-semibold text-body">{room.customName || room.title}</p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  <Users className="size-3.5" aria-hidden />
                  {occupiedRoomOccupantLabel(room)}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {availableRooms.length ? (
        <div id="property-available-rooms" className="scroll-mt-24">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Cuartos disponibles</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {availableRooms.map((room) => (
              <article id={`available-room-${room.id}`} key={room.id} className="rounded-xl border border-border bg-bg-light p-4">
                <p className="text-sm font-semibold text-body">{room.customName || room.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {money.format(room.rentMxn)} / mes - {roomDimensionWizardLabel(room.roomDimension)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                    Disponible {formatRoomAvailableFrom(room.availableFrom ?? "")}
                  </span>
                  <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                    Preferencia de Género: {genderPrefLabel(room.roommateGenderPref)}
                  </span>
                  <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                    Baño privado: {yesNo(room.tags.includes("baño-privado"))}
                  </span>
                  <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                    Estacionamiento privado: {yesNo(room.tags.includes("estacionamiento"))}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenRoom(room)}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg shadow-sm transition hover:brightness-95 sm:w-auto"
                >
                  Ver detalles completos
                </button>
              </article>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onViewPropertyDetails}
              className="inline-flex w-full max-w-sm items-center justify-center rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-body shadow-sm transition hover:bg-bg-light sm:w-auto"
            >
              Ver detalles de propiedad
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
