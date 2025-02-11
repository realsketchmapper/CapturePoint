// src/contexts/MapContext.tsx
import React, { createContext, useContext } from 'react';
import { useMapState } from '@/hooks/useMapState';
import { MapState, MapAction } from '@/types/map.types';

interface MapContextType {
  state: MapState;
  dispatch: React.Dispatch<MapAction>;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, dispatch } = useMapState();
  
  return (
    <MapContext.Provider value={{ state, dispatch }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};