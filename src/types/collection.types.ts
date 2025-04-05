import { FeatureType } from "./featureType.types";

/**
 * Represents a geographic position in either object or array format.
 * Array format is [longitude, latitude] to match maplibre and MySQL conventions.
 */
export type Position = 
  | { longitude: number; latitude: number }  // Object format
  | [longitude: number, latitude: number];   // Array format [lon, lat]

/**
 * Represents coordinates in [longitude, latitude] format.
 * This matches the format used by maplibre and MySQL Point objects.
 */
export type Coordinates = [longitude: number, latitude: number];

export interface CollectionContextType {
  isCollecting: boolean;
  currentPoints: Coordinates[]; // Store only valid positions as [lon, lat] tuples
  startCollection: (initialPosition: Position, featureType: FeatureType, options?: CollectionOptions) => CollectionState;
  stopCollection: () => void;
  recordPoint: (position: Position) => boolean;
  updateCollectionMetadata: (metadata: Partial<CollectionMetadata>) => void;
}

export interface CollectionMetadata {
  name: string;
  description: string;
  projectId: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface CollectionOptions {
  name?: string;
  description?: string;
  projectId?: number;
  created_by?: string;
}

export interface CollectionState {
    points: Coordinates[];
    isActive: boolean;
    activeFeatureType: FeatureType;
    metadata: CollectionMetadata;
}