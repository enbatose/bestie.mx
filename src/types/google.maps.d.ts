declare namespace google.maps {
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface LatLng {
    lat(): number;
    lng(): number;
  }

  interface StreetViewPov {
    heading: number;
    pitch: number;
  }

  enum StreetViewStatus {
    OK = "OK",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    ZERO_RESULTS = "ZERO_RESULTS",
  }

  interface StreetViewLocation {
    latLng?: LatLng;
    pano?: string;
  }

  interface StreetViewPanoramaData {
    location?: StreetViewLocation;
    tiles?: { centerHeading?: number };
  }

  class StreetViewService {
    getPanorama(
      request: { location: LatLngLiteral; radius?: number; source?: string },
      callback: (data: StreetViewPanoramaData | null, status: StreetViewStatus) => void,
    ): void;
  }

  interface StreetViewPanoramaOptions {
    position?: LatLngLiteral;
    pov?: StreetViewPov;
    zoom?: number;
    pano?: string;
    addressControl?: boolean;
    fullscreenControl?: boolean;
    linksControl?: boolean;
    panControl?: boolean;
    zoomControl?: boolean;
    motionTracking?: boolean;
    motionTrackingControl?: boolean;
  }

  interface MapsEventListener {
    remove(): void;
  }

  class StreetViewPanorama {
    constructor(container: HTMLElement, opts?: StreetViewPanoramaOptions);
    addListener(eventName: string, handler: () => void): MapsEventListener;
    getPov(): StreetViewPov;
    setPov(pov: StreetViewPov): void;
    getZoom(): number;
    setZoom(zoom: number): void;
    getPano(): string;
    getPosition(): LatLng | null | undefined;
    setPosition(latLng: LatLngLiteral): void;
    setPano(pano: string): void;
  }
}

interface Window {
  google?: {
    maps: typeof google.maps;
  };
}
