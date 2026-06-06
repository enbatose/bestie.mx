import L from "leaflet";

const BESTIE_DARK_GREEN = "#143D30";
const BESTIE_DARK_GREEN_STROKE = "#0F2E24";
const BESTIE_SECONDARY = "#84CC16";

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function pinSvg(opts: {
  bodyFill: string;
  centerFill: string;
  ringFill?: string;
  stroke?: string;
}): string {
  const { bodyFill, centerFill, ringFill = "#FFFFFF", stroke = BESTIE_DARK_GREEN_STROKE } = opts;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" fill="none">
      <path
        d="M15 40.2C13.2 38.05 3 26.1 3 15.15C3 8.44 8.37 3 15 3C21.63 3 27 8.44 27 15.15C27 26.1 16.8 38.05 15 40.2Z"
        fill="${bodyFill}"
        stroke="${stroke}"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <circle cx="15" cy="15" r="6.5" fill="${ringFill}" />
      <circle cx="15" cy="15" r="4.25" fill="${centerFill}" />
    </svg>
  `.trim();
}

function createPinIcon(svg: string, iconSize: [number, number], iconAnchor: [number, number]) {
  return L.icon({
    iconUrl: svgToDataUrl(svg),
    iconRetinaUrl: svgToDataUrl(svg),
    iconSize,
    iconAnchor,
    popupAnchor: [0, -34],
  });
}

/** Default pin — always pass this explicitly; `icon={undefined}` breaks cleanup with react-leaflet. */
export const standardMarkerIcon = createPinIcon(
  pinSvg({
    bodyFill: BESTIE_DARK_GREEN,
    centerFill: BESTIE_SECONDARY,
  }),
  [30, 42],
  [15, 42],
);

/** Selected pin — single module-level instance so Leaflet event wiring stays stable. */
export const selectedMarkerIcon = createPinIcon(
  pinSvg({
    bodyFill: BESTIE_DARK_GREEN,
    centerFill: "#FFFFFF",
    ringFill: BESTIE_SECONDARY,
  }),
  [34, 48],
  [17, 48],
);

/** Vite/React omit Leaflet's default image paths; set once before creating markers. */
export function ensureLeafletDefaultIcons() {
  L.Marker.prototype.options.icon = standardMarkerIcon;
}
