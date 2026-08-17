import type { ComponentType } from "react";
import { Armchair, Bath, CarFront, DoorClosed, PawPrint, Warehouse } from "lucide-react";
import { LgbtTextIcon } from "@/components/icons/LgbtTextIcon";
import { PlusOneIcon } from "@/components/icons/PlusOneIcon";
import { HighHeelIcon, MustacheIcon } from "@/components/icons/GenderFilterIcons";
import type { SelfServeComposeHints } from "@/lib/assistedDraftApi";

export type PublishAiHintState = {
  lodgingType: "private_room" | "shared_room" | null;
  loft: boolean;
  tagsOn: NonNullable<SelfServeComposeHints["tagsOn"]>;
  gender: "female" | "male" | null;
};

export const EMPTY_AI_HINTS: PublishAiHintState = {
  lodgingType: null,
  loft: false,
  tagsOn: [],
  gender: null,
};

type Chip = {
  id: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onToggle: () => void;
};

function FilterRow({ chip }: { chip: Chip }) {
  const Icon = chip.icon;
  return (
    <button
      type="button"
      aria-pressed={chip.active}
      title={chip.hint}
      onClick={chip.onToggle}
      className={`flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl border px-2 py-2 text-left transition ${
        chip.active
          ? "border-secondary bg-primary/5 ring-2 ring-secondary/35"
          : "border-border bg-surface hover:bg-surface-elevated"
      }`}
    >
      <span
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl border ${
          chip.active ? "border-secondary bg-surface text-primary" : "border-border bg-surface text-primary"
        }`}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className={`min-w-0 text-sm font-semibold hyphens-manual ${chip.active ? "text-primary" : "text-body"}`}>
        {chip.label}
      </span>
    </button>
  );
}

type Props = {
  hints: PublishAiHintState;
  onChange: (next: PublishAiHintState) => void;
};

export function PublishAiFilterChips({ hints, onChange }: Props) {
  const toggleTag = (slug: PublishAiHintState["tagsOn"][number]) => {
    const on = hints.tagsOn.includes(slug);
    onChange({
      ...hints,
      tagsOn: on ? hints.tagsOn.filter((t) => t !== slug) : [...hints.tagsOn, slug],
    });
  };

  const lodgingChips: Chip[] = [
    {
      id: "private",
      label: "Cuarto privado",
      hint: "Recámara de uso exclusivo",
      icon: DoorClosed,
      active: hints.lodgingType === "private_room",
      onToggle: () =>
        onChange({
          ...hints,
          lodgingType: hints.lodgingType === "private_room" ? null : "private_room",
        }),
    },
    {
      id: "shared",
      label: "Cuarto compartido",
      hint: "Cama o recámara compartida con otra persona",
      icon: PlusOneIcon,
      active: hints.lodgingType === "shared_room",
      onToggle: () =>
        onChange({
          ...hints,
          lodgingType: hints.lodgingType === "shared_room" ? null : "shared_room",
        }),
    },
    {
      id: "loft",
      label: "Loft",
      hint: "Propiedad tipo loft (un solo espacio)",
      icon: Warehouse,
      active: hints.loft,
      onToggle: () => onChange({ ...hints, loft: !hints.loft }),
    },
  ];

  const amenityChips: Chip[] = [
    {
      id: "pets",
      label: "Aceptan mascotas",
      hint: "Se permiten mascotas en el espacio",
      icon: PawPrint,
      active: hints.tagsOn.includes("mascotas"),
      onToggle: () => toggleTag("mascotas"),
    },
    {
      id: "lgbt",
      label: "Comunidad LGBT+",
      hint: "Espacio LGBT+ friendly",
      icon: LgbtTextIcon,
      active: hints.tagsOn.includes("lgbt-friendly"),
      onToggle: () => toggleTag("lgbt-friendly"),
    },
    {
      id: "bath",
      label: "Baño privado",
      hint: "Baño de uso exclusivo de la recámara",
      icon: Bath,
      active: hints.tagsOn.includes("baño-privado"),
      onToggle: () => toggleTag("baño-privado"),
    },
    {
      id: "parking",
      label: "Cochera incluida",
      hint: "Estacionamiento o cochera incluida",
      icon: CarFront,
      active: hints.tagsOn.includes("estacionamiento"),
      onToggle: () => toggleTag("estacionamiento"),
    },
    {
      id: "furnished",
      label: "Cuarto amueblado",
      hint: "La recámara está amueblada",
      icon: Armchair,
      active: hints.tagsOn.includes("muebles"),
      onToggle: () => toggleTag("muebles"),
    },
  ];

  const genderChips: Chip[] = [
    {
      id: "female",
      label: "Solo mujeres",
      hint: "Buscas roomie mujer. Si no eliges ninguno, puede ser cualquier género.",
      icon: HighHeelIcon,
      active: hints.gender === "female",
      onToggle: () => onChange({ ...hints, gender: hints.gender === "female" ? null : "female" }),
    },
    {
      id: "male",
      label: "Solo hombres",
      hint: "Buscas roomie hombre. Si no eliges ninguno, puede ser cualquier género.",
      icon: MustacheIcon,
      active: hints.gender === "male",
      onToggle: () => onChange({ ...hints, gender: hints.gender === "male" ? null : "male" }),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-primary">Filtros de publicación</h3>
        <p className="mt-1 text-xs text-muted">
          Opcional. Lo que enciendes queda en el anuncio. Lo que dejas apagado lo puede completar la IA
          con tu texto o infográfico.
        </p>
      </div>
      <div className="space-y-2">
        {lodgingChips.map((chip) => (
          <FilterRow key={chip.id} chip={chip} />
        ))}
      </div>
      <div className="space-y-2">
        {amenityChips.map((chip) => (
          <FilterRow key={chip.id} chip={chip} />
        ))}
      </div>
      <div>
        <p className="mb-2 text-xs text-muted">Preferencia de roomie. Si no eliges, puede ser mujer u hombre.</p>
        <div className="space-y-2">
          {genderChips.map((chip) => (
            <FilterRow key={chip.id} chip={chip} />
          ))}
        </div>
      </div>
    </div>
  );
}
