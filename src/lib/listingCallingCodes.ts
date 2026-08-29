/** ISO 3166-1 alpha-2 → ITU calling code. Listing contact only (auth stays MX). */
export const LISTING_CALLING_CODE_ROWS: readonly { iso: string; dial: string }[] = [
  { iso: "MX", dial: "52" },
  { iso: "US", dial: "1" },
  { iso: "CA", dial: "1" },
  { iso: "PR", dial: "1" },
  { iso: "DO", dial: "1" },
  { iso: "GT", dial: "502" },
  { iso: "SV", dial: "503" },
  { iso: "HN", dial: "504" },
  { iso: "NI", dial: "505" },
  { iso: "CR", dial: "506" },
  { iso: "PA", dial: "507" },
  { iso: "HT", dial: "509" },
  { iso: "PE", dial: "51" },
  { iso: "AR", dial: "54" },
  { iso: "BR", dial: "55" },
  { iso: "CL", dial: "56" },
  { iso: "CO", dial: "57" },
  { iso: "VE", dial: "58" },
  { iso: "BO", dial: "591" },
  { iso: "GY", dial: "592" },
  { iso: "EC", dial: "593" },
  { iso: "PY", dial: "595" },
  { iso: "SR", dial: "597" },
  { iso: "UY", dial: "598" },
  { iso: "CU", dial: "53" },
  { iso: "JM", dial: "1" },
  { iso: "TT", dial: "1" },
  { iso: "BS", dial: "1" },
  { iso: "BB", dial: "1" },
  { iso: "ES", dial: "34" },
  { iso: "PT", dial: "351" },
  { iso: "FR", dial: "33" },
  { iso: "DE", dial: "49" },
  { iso: "IT", dial: "39" },
  { iso: "GB", dial: "44" },
  { iso: "IE", dial: "353" },
  { iso: "NL", dial: "31" },
  { iso: "BE", dial: "32" },
  { iso: "CH", dial: "41" },
  { iso: "AT", dial: "43" },
  { iso: "SE", dial: "46" },
  { iso: "NO", dial: "47" },
  { iso: "DK", dial: "45" },
  { iso: "FI", dial: "358" },
  { iso: "PL", dial: "48" },
  { iso: "CZ", dial: "420" },
  { iso: "SK", dial: "421" },
  { iso: "HU", dial: "36" },
  { iso: "RO", dial: "40" },
  { iso: "BG", dial: "359" },
  { iso: "GR", dial: "30" },
  { iso: "TR", dial: "90" },
  { iso: "RU", dial: "7" },
  { iso: "UA", dial: "380" },
  { iso: "BY", dial: "375" },
  { iso: "KZ", dial: "7" },
  { iso: "CN", dial: "86" },
  { iso: "JP", dial: "81" },
  { iso: "KR", dial: "82" },
  { iso: "TW", dial: "886" },
  { iso: "HK", dial: "852" },
  { iso: "MO", dial: "853" },
  { iso: "IN", dial: "91" },
  { iso: "PK", dial: "92" },
  { iso: "BD", dial: "880" },
  { iso: "LK", dial: "94" },
  { iso: "NP", dial: "977" },
  { iso: "TH", dial: "66" },
  { iso: "VN", dial: "84" },
  { iso: "PH", dial: "63" },
  { iso: "ID", dial: "62" },
  { iso: "MY", dial: "60" },
  { iso: "SG", dial: "65" },
  { iso: "AU", dial: "61" },
  { iso: "NZ", dial: "64" },
  { iso: "ZA", dial: "27" },
  { iso: "EG", dial: "20" },
  { iso: "MA", dial: "212" },
  { iso: "DZ", dial: "213" },
  { iso: "TN", dial: "216" },
  { iso: "LY", dial: "218" },
  { iso: "NG", dial: "234" },
  { iso: "GH", dial: "233" },
  { iso: "KE", dial: "254" },
  { iso: "TZ", dial: "255" },
  { iso: "UG", dial: "256" },
  { iso: "ET", dial: "251" },
  { iso: "IL", dial: "972" },
  { iso: "PS", dial: "970" },
  { iso: "JO", dial: "962" },
  { iso: "LB", dial: "961" },
  { iso: "SY", dial: "963" },
  { iso: "IQ", dial: "964" },
  { iso: "SA", dial: "966" },
  { iso: "AE", dial: "971" },
  { iso: "QA", dial: "974" },
  { iso: "KW", dial: "965" },
  { iso: "BH", dial: "973" },
  { iso: "OM", dial: "968" },
  { iso: "YE", dial: "967" },
  { iso: "IR", dial: "98" },
  { iso: "AF", dial: "93" },
  { iso: "AM", dial: "374" },
  { iso: "AZ", dial: "994" },
  { iso: "GE", dial: "995" },
  { iso: "UZ", dial: "998" },
  { iso: "TM", dial: "993" },
  { iso: "TJ", dial: "992" },
  { iso: "KG", dial: "996" },
  { iso: "MN", dial: "976" },
  { iso: "KH", dial: "855" },
  { iso: "LA", dial: "856" },
  { iso: "MM", dial: "95" },
  { iso: "BN", dial: "673" },
  { iso: "FJ", dial: "679" },
  { iso: "PG", dial: "675" },
  { iso: "NC", dial: "687" },
  { iso: "PF", dial: "689" },
  { iso: "IS", dial: "354" },
  { iso: "LU", dial: "352" },
  { iso: "MT", dial: "356" },
  { iso: "CY", dial: "357" },
  { iso: "EE", dial: "372" },
  { iso: "LV", dial: "371" },
  { iso: "LT", dial: "370" },
  { iso: "SI", dial: "386" },
  { iso: "HR", dial: "385" },
  { iso: "BA", dial: "387" },
  { iso: "RS", dial: "381" },
  { iso: "ME", dial: "382" },
  { iso: "MK", dial: "389" },
  { iso: "AL", dial: "355" },
  { iso: "MD", dial: "373" },
  { iso: "AD", dial: "376" },
  { iso: "MC", dial: "377" },
  { iso: "SM", dial: "378" },
  { iso: "LI", dial: "423" },
  { iso: "GI", dial: "350" },
  { iso: "FO", dial: "298" },
  { iso: "GL", dial: "299" },
  { iso: "AW", dial: "297" },
  { iso: "CW", dial: "599" },
  { iso: "BQ", dial: "599" },
  { iso: "SX", dial: "1" },
  { iso: "KY", dial: "1" },
  { iso: "BM", dial: "1" },
  { iso: "VG", dial: "1" },
  { iso: "VI", dial: "1" },
  { iso: "AI", dial: "1" },
  { iso: "MS", dial: "1" },
  { iso: "KN", dial: "1" },
  { iso: "AG", dial: "1" },
  { iso: "DM", dial: "1" },
  { iso: "LC", dial: "1" },
  { iso: "VC", dial: "1" },
  { iso: "GD", dial: "1" },
  { iso: "TC", dial: "1" },
  { iso: "GP", dial: "590" },
  { iso: "MQ", dial: "596" },
  { iso: "GF", dial: "594" },
  { iso: "RE", dial: "262" },
  { iso: "YT", dial: "262" },
  { iso: "SN", dial: "221" },
  { iso: "CI", dial: "225" },
  { iso: "CM", dial: "237" },
  { iso: "AO", dial: "244" },
  { iso: "MZ", dial: "258" },
  { iso: "ZW", dial: "263" },
  { iso: "ZM", dial: "260" },
  { iso: "BW", dial: "267" },
  { iso: "NA", dial: "264" },
  { iso: "MW", dial: "265" },
  { iso: "MG", dial: "261" },
  { iso: "MU", dial: "230" },
  { iso: "SC", dial: "248" },
  { iso: "RW", dial: "250" },
  { iso: "BI", dial: "257" },
  { iso: "CD", dial: "243" },
  { iso: "CG", dial: "242" },
  { iso: "GA", dial: "241" },
  { iso: "GQ", dial: "240" },
  { iso: "ST", dial: "239" },
  { iso: "CV", dial: "238" },
  { iso: "GM", dial: "220" },
  { iso: "GN", dial: "224" },
  { iso: "GW", dial: "245" },
  { iso: "SL", dial: "232" },
  { iso: "LR", dial: "231" },
  { iso: "TG", dial: "228" },
  { iso: "BJ", dial: "229" },
  { iso: "BF", dial: "226" },
  { iso: "ML", dial: "223" },
  { iso: "NE", dial: "227" },
  { iso: "TD", dial: "235" },
  { iso: "CF", dial: "236" },
  { iso: "SS", dial: "211" },
  { iso: "SD", dial: "249" },
  { iso: "ER", dial: "291" },
  { iso: "DJ", dial: "253" },
  { iso: "SO", dial: "252" },
  { iso: "KM", dial: "269" },
  { iso: "LS", dial: "266" },
  { iso: "SZ", dial: "268" },
  { iso: "MR", dial: "222" },
];

const regionNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["es"], { type: "region" })
    : null;

export type ListingCallingCodeOption = {
  iso: string;
  dial: string;
  label: string;
  nationalLen: number;
};

/** E.164: max 15 digits including the country code. México / NANP stay 10. */
export function nationalLenForDial(dial: string): number {
  if (dial === "52" || dial === "1") return 10;
  return Math.max(6, Math.min(15 - dial.length, 12));
}

export function listingCountryLabel(iso: string, fallbackDial: string): string {
  const name = regionNames?.of(iso);
  return name && name !== iso ? name : `+${fallbackDial}`;
}

export function listingCallingCodeOptions(): ListingCallingCodeOption[] {
  return LISTING_CALLING_CODE_ROWS.map((row) => ({
    iso: row.iso,
    dial: row.dial,
    label: listingCountryLabel(row.iso, row.dial),
    nationalLen: nationalLenForDial(row.dial),
  }));
}

/** Unique dials, longest first — used to split stored digits into prefix + national. */
export function listingDialsLongestFirst(): string[] {
  return [...new Set(LISTING_CALLING_CODE_ROWS.map((r) => r.dial))].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    if (a === "52") return -1;
    if (b === "52") return 1;
    return a.localeCompare(b);
  });
}

export function filterListingCallingCodes(
  options: readonly ListingCallingCodeOption[],
  query: string,
): ListingCallingCodeOption[] {
  const q = query.trim().toLowerCase().replace(/^\+/, "");
  const mx = options.filter((o) => o.iso === "MX");
  const rest = options
    .filter((o) => o.iso !== "MX")
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const ordered = [...mx, ...rest];
  if (!q) return ordered;
  return ordered.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      o.dial.startsWith(q) ||
      o.iso.toLowerCase().includes(q),
  );
}
