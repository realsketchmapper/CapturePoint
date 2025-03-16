import { Feature } from "./features.types";

export type Position = { longitude: number; latitude: number } | [number, number];

export type Coordinates = [number, number];

export interface CollectionContextType {
  isCollecting: boolean;
  currentPoints: [number, number][]; // Store only valid positions as tuples
  startCollection: (initialPosition: Position, feature: Feature) => CollectionState;
  stopCollection: () => void;
  recordPoint: (position: Position) => boolean;
}

export interface CollectionState {
    points: [number, number][];
    isActive: boolean;
    activeFeature: Feature | null;
    //featureType: 'point' | 'line' | 'polygon';
  }