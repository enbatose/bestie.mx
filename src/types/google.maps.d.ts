declare namespace google.maps {
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface StreetViewPov {
    heading: number;
    pitch: number;
  }

  interface StreetViewPanoramaOptions {
    position?: LatLngLiteral;
    pov?: StreetViewPov;
    zoom?: number;
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
    setPosition(latLng: LatLngLiteral): void;
  }
}

interface Window {
  google?: {
    maps: typeof google.maps;
  };
}
