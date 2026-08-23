import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import { App } from "./App";
import { PostHogApp } from "@/components/analytics/PostHogApp";

/* Leaflet + react-leaflet can throw during marker teardown under React StrictMode
   (dev-only double mount). CSR map pages are stable without StrictMode here.
   PostHog / Meta Pixel init only after cookie consent (see CookieConsentBanner). */
createRoot(document.getElementById("root")!).render(
  <PostHogApp>
    <App />
  </PostHogApp>,
);
