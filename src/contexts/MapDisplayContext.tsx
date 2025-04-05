import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Feature, Point, LineString, FeatureCollection, GeoJsonProperties } from 'geojson';
import { FeatureToRender } from '@/src/types/featureType.types';
import { MapContextType, Coordinate, FeatureType } from '@/src/types/map.types';
import { generateId } from '@/src/utils/collections';

const MapContext = createContext<MapContextType | undefined>(undefined);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};

// Define action types
type MapAction = 
  | { type: 'SET_MAP_READY'; payload: boolean }
  | { type: 'ADD_FEATURE'; payload: Feature }
  | { type: 'UPDATE_FEATURE'; payload: { id: string; feature: Feature } }
  | { type: 'REMOVE_FEATURE'; payload: string }
  | { type: 'CLEAR_FEATURES' }
  | { type: 'SET_ERROR'; payload: string | null };

// Define initial state
interface MapState {
  isMapReady: boolean;
  features: FeatureCollection;
  error: string | null;
}

const initialState: MapState = {
  isMapReady: false,
  features: {
    type: 'FeatureCollection',
    features: []
  },
  error: null
};

// Reducer function
function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'SET_MAP_READY':
      return { 
        ...state, 
        isMapReady: action.payload 
      };
    case 'ADD_FEATURE':
      return { 
        ...state, 
        features: {
          ...state.features,
          features: [...state.features.features, action.payload]
        }
      };
    case 'UPDATE_FEATURE':
      return { 
        ...state, 
        features: {
          ...state.features,
          features: state.features.features.map(feature => 
            feature.id === action.payload.id ? action.payload.feature : feature
          )
        }
      };
    case 'REMOVE_FEATURE':
      return { 
        ...state, 
        features: {
          ...state.features,
          features: state.features.features.filter(feature => feature.id !== action.payload)
        }
      };
    case 'CLEAR_FEATURES':
      return { 
        ...state, 
        features: {
          type: 'FeatureCollection',
          features: []
        }
      };
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload 
      };
    default:
      return state;
  }
}

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(mapReducer, initialState);

  // Validate coordinates for both points and lines
  const isValidCoords = useCallback((coords: any): boolean => {
    if (!Array.isArray(coords)) return false;
    
    // Point coordinate [lng, lat]
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return !isNaN(coords[0]) && !isNaN(coords[1]);
    }
    
    // Line coordinates [[lng, lat], [lng, lat], ...]
    if (Array.isArray(coords[0])) {
      return coords.every(point => 
        Array.isArray(point) && 
        point.length === 2 && 
        !isNaN(point[0]) && 
        !isNaN(point[1])
      );
    }
    
    return false;
  }, []);

  // Add a point to the map
  const addPoint = useCallback((coordinates: Coordinate, properties: GeoJsonProperties = {}) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to addPoint');
      dispatch({ type: 'SET_ERROR', payload: 'Invalid coordinates provided to addPoint' });
      return null;
    }

    const id = generateId();
    
    const pointFeature: Feature<Point> = {
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates
      },
      properties
    };
    
    dispatch({ type: 'ADD_FEATURE', payload: pointFeature });
    return id;
  }, [isValidCoords]);

  // Add a line to the map
  const addLine = useCallback((coordinates: Coordinate[], properties: GeoJsonProperties = {}) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to addLine');
      dispatch({ type: 'SET_ERROR', payload: 'Invalid coordinates provided to addLine' });
      return null;
    }

    const id = generateId();
    
    const lineFeature: Feature<LineString> = {
      type: 'Feature',
      id,
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties
    };
    
    dispatch({ type: 'ADD_FEATURE', payload: lineFeature });
    return id;
  }, [isValidCoords]);

  // Update an existing feature
  const updateFeature = useCallback((id: string, coordinates: Coordinate | Coordinate[]) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to updateFeature');
      dispatch({ type: 'SET_ERROR', payload: 'Invalid coordinates provided to updateFeature' });
      return;
    }
    
    const featureToUpdate = state.features.features.find(feature => feature.id === id);
    if (!featureToUpdate) {
      console.warn(`Feature with id ${id} not found`);
      dispatch({ type: 'SET_ERROR', payload: `Feature with id ${id} not found` });
      return;
    }
    
    const isPoint = featureToUpdate.geometry.type === 'Point';
    
    // Create a new feature with updated coordinates
    const updatedFeature: Feature = {
      ...featureToUpdate,
      geometry: {
        ...featureToUpdate.geometry,
        type: isPoint ? 'Point' : 'LineString',
        coordinates
      } as Point | LineString
    };
    
    dispatch({ type: 'UPDATE_FEATURE', payload: { id, feature: updatedFeature } });
  }, [isValidCoords, state.features.features]);

  // Remove a feature
  const removeFeature = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FEATURE', payload: id });
  }, []);

  // Clear all features
  const clearFeatures = useCallback(() => {
    dispatch({ type: 'CLEAR_FEATURES' });
  }, []);

  // Render any type of feature
  const renderFeature = useCallback((feature: FeatureToRender) => {
    if (feature.type === 'Point') {
      return addPoint(feature.coordinates as Coordinate, feature.properties);
    } else if (feature.type === 'Line') {
      return addLine(feature.coordinates as Coordinate[], feature.properties);
    }
    console.warn(`Unsupported feature type: ${feature.type}`);
    dispatch({ type: 'SET_ERROR', payload: `Unsupported feature type: ${feature.type}` });
    return null;
  }, [addPoint, addLine]);

  // Preview a feature
  const previewFeature = useCallback((
    coordinates: Coordinate | Coordinate[], 
    type: FeatureType
  ) => {
    const previewProps = { isPreview: true, previewStyle: true };
    
    if (type === 'point') {
      return addPoint(coordinates as Coordinate, previewProps);
    } else if (type === 'line') {
      return addLine(coordinates as Coordinate[], previewProps);
    }
    
    console.warn(`Unsupported preview type: ${type}`);
    dispatch({ type: 'SET_ERROR', payload: `Unsupported preview type: ${type}` });
    return null;
  }, [addPoint, addLine]);

  return (
    <MapContext.Provider value={{
      addPoint,
      addLine,
      updateFeature,
      removeFeature,
      clearFeatures,
      features: state.features,
      isMapReady: state.isMapReady,
      setIsMapReady: (ready: boolean) => dispatch({ type: 'SET_MAP_READY', payload: ready }),
      renderFeature,
      previewFeature
    }}>
      {children}
    </MapContext.Provider>
  );
};

export default MapProvider;