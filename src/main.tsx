import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

/* Leaflet + react-leaflet can throw during marker teardown under React StrictMode
   (dev-only double mount). CSR map pages are stable without StrictMode here. */
createRoot(document.getElementById("root")!).render(<App />);
