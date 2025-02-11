// src/contexts/MapContext.tsx
import React, { createContext, useContext, useReducer } from 'react';

// Simplified state type
interface MapState {
  isMapReady: boolean;
  center: [number, number];
  zoom: number;
}

// Simplified actions
type MapAction = 
  | { type: 'SET_MAP_READY'; payload: boolean }
  | { type: 'SET_CENTER'; payload: [number, number] }
  | { type: 'SET_ZOOM'; payload: number };

// Initial state
const initialState: MapState = {
  isMapReady: false,
  center: [-122.4194, 37.7749], // Default center (San Francisco)
  zoom: 12
};

// Simple reducer
function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'SET_MAP_READY':
      return { ...state, isMapReady: action.payload };
    case 'SET_CENTER':
      return { ...state, center: action.payload };
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };
    default:
      return state;
  }
}

// Context type
interface MapContextType {
  state: MapState;
  dispatch: React.Dispatch<MapAction>;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(mapReducer, initialState);
  
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