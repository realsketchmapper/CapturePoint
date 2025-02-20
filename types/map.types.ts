import { GeoJsonProperties } from "geojson";
import { FeatureCollection } from "geojson";
import { FeatureType } from "./features.types";

export interface MapFeature {
    id: string;
    coordinates: [number, number] | [number, number][];
    type: FeatureType;
    properties?: GeoJsonProperties;
  }
  
  export interface CameraOptions {
    centerCoordinate: [number, number];
    zoomLevel: number;
    animationDuration?: number;
  }
  

export interface MapContextType {
  // Core map state
  features: FeatureCollection;
  isMapReady: boolean;
  setIsMapReady: (ready: boolean) => void;

  // Feature manipulation
  addPoint: (coordinates: [number, number], properties?: GeoJsonProperties) => string;
  addLine: (coordinates: [number, number][], properties?: GeoJsonProperties) => string;
  updateFeature: (id: string, coordinates: [number, number] | [number, number][]) => void;
  removeFeature: (id: string) => void;
  clearFeatures: () => void;

  // Camera control
  setCamera: (options: CameraOptions) => void;

  renderFeature: (feature: {
    type: FeatureType;
    coordinates: [number, number] | [number, number][];
    properties?: GeoJsonProperties;
  }) => string;
  previewFeature: (
    coordinates: [number, number] | [number, number][],
    type: FeatureType
  ) => string;
}