import type { FeatureCollection, GeoJsonProperties, Feature } from 'geojson';
import { FeatureToRender } from './featuresToRender.types';

// Simplified type definitions
export type Coordinate = [number, number];
export type FeatureType = 'point' | 'line' | 'polygon';

export interface MapContextType {
  // Feature management
  addPoint: (coordinates: Coordinate, properties?: GeoJsonProperties) => string | null;
  addLine: (coordinates: Coordinate[], properties?: GeoJsonProperties) => string | null;
  addFeature: (feature: Feature) => void;
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
  
  // Sync state and operations
  isSyncing: boolean;
  lastSyncTime: string | null;
  error: string | null;
  syncFeatures: () => Promise<void>;
  syncAllProjects: () => Promise<void>;
  setError: (error: string | null) => void;
}