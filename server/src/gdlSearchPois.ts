/** Named GDL landmarks used to resolve seeker posts (“cerca del ITESO”, Andares, …). */
export type SearchPoi = {
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
};

export const GDL_SEARCH_POIS: readonly SearchPoi[] = [
  {
    name: "ITESO",
    lat: 20.6066,
    lng: -103.4156,
    aliases: ["iteso", "iteso universidad", "universidad iteso"],
  },
  {
    name: "UVM",
    lat: 20.6102,
    lng: -103.4034,
    aliases: ["uvm", "uvm sur", "universidad del valle de mexico"],
  },
  {
    name: "Tec de Monterrey",
    lat: 20.7351,
    lng: -103.4542,
    aliases: ["tec", "itesm", "tec de monterrey", "tec guadalajara", "campus guadalajara"],
  },
  {
    name: "Universidad Panamericana",
    lat: 20.6974,
    lng: -103.4162,
    aliases: ["up", "panamericana", "universidad panamericana"],
  },
  {
    name: "CUCS",
    lat: 20.6862,
    lng: -103.3271,
    aliases: ["cucs", "centro universitario de ciencias de la salud"],
  },
  {
    name: "CUCEI",
    lat: 20.6564,
    lng: -103.3254,
    aliases: ["cucei"],
  },
  {
    name: "CUCEA",
    lat: 20.7391,
    lng: -103.3824,
    aliases: ["cucea"],
  },
  {
    name: "CUAAD",
    lat: 20.6874,
    lng: -103.3512,
    aliases: ["cuaad"],
  },
  {
    name: "UAG",
    lat: 20.6968,
    lng: -103.4189,
    aliases: ["uag", "autonoma de guadalajara"],
  },
  {
    name: "Andares",
    lat: 20.7104,
    lng: -103.4118,
    aliases: ["andares", "zona real", "puerta de hierro"],
  },
  {
    name: "Galerías",
    lat: 20.6773,
    lng: -103.4384,
    aliases: ["galerias", "galerías", "plaza galerias"],
  },
  {
    name: "Punto Sao Paulo",
    lat: 20.6704,
    lng: -103.4402,
    aliases: ["punto sao paulo", "sao paulo", "midtown", "midtown jalisco"],
  },
  {
    name: "Zona Chapultepec/Americana",
    lat: 20.6746,
    lng: -103.3665,
    aliases: [
      "zona chapultepec",
      "chapultepec",
      "americana",
      "colonia americana",
      "moderna",
      "lafayette",
      "zona chapultepec/americana",
    ],
  },
  {
    name: "Zona Minerva",
    lat: 20.67439,
    lng: -103.38739,
    aliases: ["minerva", "la minerva", "zona minerva", "justo sierra", "vallarta norte"],
  },
  {
    name: "Centro",
    lat: 20.675138,
    lng: -103.347345,
    aliases: ["centro", "centro historico", "centro histórico", "downtown"],
  },
  {
    name: "Chapalita",
    lat: 20.6682,
    lng: -103.4008,
    aliases: ["chapalita"],
  },
  {
    name: "Providencia",
    lat: 20.6984,
    lng: -103.3786,
    aliases: ["providencia"],
  },
];

export function normalizePlaceKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
