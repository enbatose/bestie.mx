import { MessageCircle } from "lucide-react";
import { ListingPhoneReveal } from "@/components/listing/ListingPhoneReveal";
import type { AuthMe } from "@/lib/authApi";
import { PropertyMessageField } from "@/components/listing/postExperience/PropertyMessageField";
import { ListingSection } from "@/components/listing/ListingSection";
import type { Room } from "@/types/listing";

type BaseProps = {
  canContact: boolean;
  messagingOn: boolean;
  viewer: AuthMe | null | undefined;
  listingId?: string;
  propertyId?: string;
  hasContactPhone?: boolean;
  phoneRevealRole?: "seeker" | "publisher";
  /** Claim-link draft: hide the empty Contactar block (phone lives in the claim banner). */
  hideWhenUnavailable?: boolean;
  msgBusy: boolean;
  msgErr: string | null;
  onSend: () => void;
};

type SingleProps = BaseProps & {
  mode: "single";
  message: string;
  onMessageChange: (value: string) => void;
};

type PropertyProps = BaseProps & {
  mode: "property";
  message: string;
  onMessageChange: (value: string) => void;
  selectedRoomIds: string[];
  onToggleRoom: (roomId: string) => void;
  availableRooms: readonly Room[];
  onRoomClick: (room: Room) => void;
};

type Props = SingleProps | PropertyProps;

function sendLabel(viewer: AuthMe | null | undefined, msgBusy: boolean): string {
  if (msgBusy) return "Enviando…";
  if (viewer === undefined) return "Comprobando sesión…";
  if (!viewer) return "Enviar mensaje (inicia sesión)";
  return "Enviar mensaje";
}

export function PostExperienceContactSection(props: Props) {
  const { canContact, messagingOn, viewer, msgBusy, msgErr, onSend } = props;
  const phoneOnly =
    !canContact && Boolean(props.hasContactPhone && props.listingId) && !props.hideWhenUnavailable;

  if (!canContact && !phoneOnly) {
    if (props.hideWhenUnavailable) return null;
    return (
      <ListingSection title="Contactar anunciante">
        <p className="text-sm text-muted">Este anuncio no acepta contacto en este momento.</p>
      </ListingSection>
    );
  }

  if (phoneOnly) {
    return (
      <div id={props.mode === "property" ? "property-contact" : "contacto"} className="scroll-mt-24">
        <ListingSection title="Contactar anunciante">
          <ListingPhoneReveal
            listingId={props.listingId!}
            propertyId={props.propertyId}
            viewer={viewer}
            hasContactPhone={props.hasContactPhone}
            role={props.phoneRevealRole ?? "seeker"}
            compact={props.mode === "single"}
          />
        </ListingSection>
      </div>
    );
  }

  return (
    <div id={props.mode === "property" ? "property-contact" : "contacto"} className="scroll-mt-24">
      <ListingSection title="Contactar anunciante">
        <div id="contacto-mensaje" className="scroll-mt-24 rounded-xl border border-border bg-bg-light p-4">
          {props.mode === "property" ? (
            <>
              <p className="text-sm font-medium text-body">¿Qué cuartos te interesan?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {props.availableRooms.map((room) => {
                  const checked = props.selectedRoomIds.includes(room.id);
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => props.onToggleRoom(room.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        checked ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-body"
                      }`}
                    >
                      {room.customName || room.title}
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block text-sm font-medium text-body">
                Mensaje
                <PropertyMessageField
                  message={props.message}
                  onMessageChange={props.onMessageChange}
                  selectedIds={props.selectedRoomIds}
                  rooms={props.availableRooms}
                  onRoomClick={props.onRoomClick}
                />
              </label>
            </>
          ) : (
            <label className="block text-sm font-medium text-body">
              Mensaje inicial
              <textarea
                value={props.message}
                onChange={(event) => props.onMessageChange(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body"
              />
            </label>
          )}

          {props.hasContactPhone && props.listingId ? (
            <div id="contacto-telefono" className="mt-4 scroll-mt-24">
              <ListingPhoneReveal
                listingId={props.listingId}
                propertyId={props.propertyId}
                viewer={viewer}
                hasContactPhone={props.hasContactPhone}
                role={props.phoneRevealRole ?? "seeker"}
                compact={props.mode === "single"}
              />
            </div>
          ) : null}

          {msgErr ? <p className="mt-2 text-sm text-error">{msgErr}</p> : null}

          {messagingOn ? (
            <button
              type="button"
              onClick={onSend}
              disabled={msgBusy || viewer === undefined}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
            >
              <MessageCircle className="size-4" aria-hidden />
              {sendLabel(viewer, msgBusy)}
            </button>
          ) : (
            <p className="mt-3 text-sm text-muted">Los mensajes en Bestie no están disponibles en este entorno.</p>
          )}
        </div>
      </ListingSection>
    </div>
  );
}
