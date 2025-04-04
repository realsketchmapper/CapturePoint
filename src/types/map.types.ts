import type { FeatureCollection, GeoJsonProperties } from 'geojson';
import { FeatureToRender } from './featureType.types';

// Simplified type definitions
export type Coordinate = [number, number];
export type FeatureType = 'point' | 'line' | 'polygon';

export interface MapContextType {
  // Feature management
  addPoint: (coordinates: Coordinate, properties?: GeoJsonProperties) => string | null;
  addLine: (coordinates: Coordinate[], properties?: GeoJsonProperties) => string | null;
  updateFeature: (id: string, coordinates: Coordinate | Coordinate[]) => void;
  removeFeature: (id: string) => void;
  clearFeatures: () => void;
  
  // Map state
  features: FeatureCollection;
  isMapReady: boolean;
  setIsMapReady: (ready: boolean) => void;
  
  // Feature rendering
  renderFeature: (feature: FeatureToRender) => string | null;
  previewFeature: (coordinates: Coordinate | Coordinate[], type: FeatureType) => string | null;
}