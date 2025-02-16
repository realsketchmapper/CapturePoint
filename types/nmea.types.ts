export type Point = {
    id: string;
    latitude: number;
    longitude: number;
    timestamp?: string;
    lineId?: string | null;
    isLineStart?: boolean;
  };
  
  export interface GNSSContextType {
    collectPoint: () => Promise<void>;
    lastCollectedPoint: {
      latitude: number | null;
      longitude: number | null;
      timestamp: string | null;
      rawNMEA: string | null;
    };
    collectionSettings: {
      useTimedCollection: boolean;
      collectionDuration: number;
    };
    setCollectionSettings: (settings: {
      useTimedCollection: boolean;
      collectionDuration: number;
    }) => void;
  }
  
  
  export const INITIAL_COORDINATES = {
    latitude: 39.7657,
    longitude: -86.2855,
  } as const;