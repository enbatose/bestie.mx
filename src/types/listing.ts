export type RoommateGenderPref = "any" | "female" | "male";

export type ListingTag =
  | "wifi"
  | "mascotas"
  | "estacionamiento"
  | "muebles"
  | "baño-privado";

export type PropertyListing = {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  rentMxn: number;
  roomsAvailable: number;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  summary: string;
  contactWhatsApp: string;
};
