import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

/** Default pin — always pass this explicitly; `icon={undefined}` breaks cleanup with react-leaflet. */
export const standardMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Selected pin — single module-level instance so Leaflet event wiring stays stable. */
export const selectedMarkerIcon = L.divIcon({
  className: "bestie-selected-pin",
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#84CC16;border:3px solid #143D30;box-shadow:0 2px 8px rgba(15,23,42,.25);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Vite/React omit Leaflet's default image paths; set once before creating markers. */
export function ensureLeafletDefaultIcons() {
  L.Marker.prototype.options.icon = standardMarkerIcon;
}
