import { ListingTagChips } from "@/components/listing/ListingTagChips";
import { KEY_LABEL_ROOM_TAG_SLUGS } from "@/lib/listingKeyLabels";
import {
  PROPERTY_AMENITY_TAG_SLUGS,
  ROOM_IDEAL_PARA_TAG_SET,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";
import type { ListingTag } from "@/types/listing";

const PROPERTY_AMENITY_TAG_SET = new Set<string>(PROPERTY_AMENITY_TAG_SLUGS);
const ROOM_PHYSICAL_TAG_SET = new Set<string>(ROOM_TAG_GROUPS[0].tags);

export function RoomSecondaryTagSections({ tags }: { tags: readonly ListingTag[] }) {
  const amenityTags = tags.filter((tag) => PROPERTY_AMENITY_TAG_SET.has(tag));
  const physicalTags = tags.filter((tag) => ROOM_PHYSICAL_TAG_SET.has(tag) && !KEY_LABEL_ROOM_TAG_SLUGS.has(tag));
  const idealTags = tags.filter((tag) => ROOM_IDEAL_PARA_TAG_SET.has(tag) && !KEY_LABEL_ROOM_TAG_SLUGS.has(tag));

  if (!amenityTags.length && !physicalTags.length && !idealTags.length) {
    return <p className="text-sm italic text-muted">Sin etiquetas adicionales.</p>;
  }

  return (
    <div className="space-y-5">
      {amenityTags.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">La propiedad cuenta con</p>
          <div className="mt-2">
            <ListingTagChips tags={amenityTags} />
          </div>
        </div>
      ) : null}
      {physicalTags.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Propiedades de la recámara</p>
          <div className="mt-2">
            <ListingTagChips tags={physicalTags} />
          </div>
        </div>
      ) : null}
      {idealTags.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ideal para</p>
          <div className="mt-2">
            <ListingTagChips tags={idealTags} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
