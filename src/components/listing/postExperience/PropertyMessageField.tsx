import type { Room } from "@/types/listing";

type Props = {
  message: string;
  onMessageChange: (value: string) => void;
  selectedIds: string[];
  rooms: readonly Room[];
  onRoomClick: (room: Room) => void;
};

export function PropertyMessageField({
  message,
  onMessageChange,
  selectedIds,
  rooms,
  onRoomClick,
}: Props) {
  const selectedRooms = selectedIds
    .map((id) => rooms.find((room) => room.id === id))
    .filter((room): room is Room => Boolean(room));

  return (
    <div className="ph-no-capture mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2">
      <textarea
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        rows={3}
        className="w-full resize-y border-0 bg-transparent p-0 text-sm leading-relaxed text-body outline-none focus:ring-0"
      />
      {selectedRooms.length ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-body">
          Me interesan:{" "}
          {selectedRooms.map((room, index) => {
            const isLast = index === selectedRooms.length - 1;
            const separator =
              selectedRooms.length > 2 && !isLast
                ? ", "
                : selectedRooms.length === 2 && index === 0
                  ? " y "
                  : "";

            return (
              <span key={room.id}>
                <a
                  href={`#available-room-${room.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onRoomClick(room);
                  }}
                  className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                >
                  {room.customName || room.title}
                </a>
                {!isLast ? separator : null}
              </span>
            );
          })}
          .
        </p>
      ) : null}
    </div>
  );
}
