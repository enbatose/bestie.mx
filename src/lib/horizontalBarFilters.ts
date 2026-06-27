import type { LucideIcon } from "lucide-react";
import { Banknote, UserRound } from "lucide-react";
import {
  HighHeelIcon,
  MustacheIcon,
} from "@/components/icons/GenderFilterIcons";
import type { SearchFilters } from "@/lib/searchFilters";

export type HorizontalBarFilterRow = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  active: boolean;
};

/** Renta, Género y Edad — same fields as the horizontal search bar. */
export function horizontalBarFilterRows(filters: SearchFilters): HorizontalBarFilterRow[] {
  let rentValue = "Sin límite";
  if (filters.budgetMax != null) {
    rentValue = `Hasta $${filters.budgetMax.toLocaleString("es-MX")}`;
  } else if (filters.budgetMin != null) {
    rentValue = `Desde $${filters.budgetMin.toLocaleString("es-MX")}`;
  }

  let genderValue = "Cualquiera";
  let genderIcon: LucideIcon = HighHeelIcon;
  if (filters.pref === "female") {
    genderValue = "Mujer";
    genderIcon = HighHeelIcon;
  } else if (filters.pref === "male") {
    genderValue = "Hombre";
    genderIcon = MustacheIcon;
  }

  let ageValue = "Sin filtro";
  if (filters.age != null) {
    ageValue = `${filters.age} años`;
  } else if (filters.ageMin != null || filters.ageMax != null) {
    ageValue = `${filters.ageMin ?? 18}–${filters.ageMax ?? 99} años`;
  }

  return [
    {
      id: "horizontal-rent",
      label: "Renta",
      value: rentValue,
      icon: Banknote,
      active: filters.budgetMax != null || filters.budgetMin != null,
    },
    {
      id: "horizontal-gender",
      label: "Género",
      value: genderValue,
      icon: genderIcon,
      active: filters.pref != null,
    },
    {
      id: "horizontal-age",
      label: "Edad",
      value: ageValue,
      icon: UserRound,
      active: filters.age != null || filters.ageMin != null || filters.ageMax != null,
    },
  ];
}

export function horizontalBarHasActiveFilter(filters: SearchFilters): boolean {
  return horizontalBarFilterRows(filters).some((row) => row.active);
}
