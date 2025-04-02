import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Feature, Point, LineString, FeatureCollection, GeoJsonProperties } from 'geojson';
import { FeatureToRender, FeatureType } from '@/types/features.types';
import { MapContextType, Coordinate } from '@/types/map.types';
import { generateId } from '@/utils/collections';
import { LINE_POINT_FEATURE } from '@/constants/features';
import { useFeatureData } from '@/contexts/FeatureDataContext';
import { useProjectContext } from '@/contexts/ProjectContext';

const MapContext = createContext<MapContextType | undefined>(undefined);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMapReady, setIsMapReady] = useState(false);
  const { features, refreshFeatures } = useFeatureData();
  const { activeProject } = useProjectContext();

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
  const addPoint = useCallback((coordinates: Coordinate, properties?: GeoJsonProperties) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates:', coordinates);
      return null;
    }

    const client_id = generateId();
    const feature: Feature<Point, GeoJsonProperties> = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates
      },
      properties: {
        client_id,
        ...properties,
        featureType: properties?.featureType || null
      }
    };

    return client_id;
  }, [isValidCoords]);

  // Add a line to the map
  const addLine = useCallback((coordinates: Coordinate[], properties: GeoJsonProperties = {}) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to addLine');
      return null;
    }

    const client_id = generateId();
    
    // Create the line feature without auto-closing it
    const lineFeature: Feature<LineString> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties: {
        client_id,
        ...properties
      }
    };

    return client_id;
  }, [isValidCoords]);

  // Update an existing feature
  const updateFeature = useCallback((client_id: string, coordinates: Coordinate | Coordinate[]) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to updateFeature');
      return;
    }
  }, [isValidCoords]);

  // Remove a feature
  const removeFeature = useCallback((client_id: string) => {
    // Implementation will be handled by the map component
  }, []);

  // Clear all features
  const clearFeatures = useCallback(() => {
    // Implementation will be handled by the map component
  }, []);

  // Render any type of feature
  const renderFeature = useCallback((feature: FeatureToRender) => {
    if (feature.type === 'Point') {
      return addPoint(feature.coordinates as Coordinate, feature.properties);
    } else if (feature.type === 'Line') {
      return addLine(feature.coordinates as Coordinate[], feature.properties);
    }
    console.warn(`Unsupported feature type: ${feature.type}`);
    return null;
  }, [addPoint, addLine]);

  // Preview a feature
  const previewFeature = useCallback((
    coordinates: Coordinate | Coordinate[], 
    type: FeatureType
  ) => {
    const previewProps = { isPreview: true, previewStyle: true };
    
    if (type.geometryType === 'Point') {
      return addPoint(coordinates as Coordinate, previewProps);
    } else if (type.geometryType === 'Line' || type.geometryType === 'Polygon') {
      return addLine(coordinates as Coordinate[], previewProps);
    }
    
    return null;
  }, [addPoint, addLine]);

  // Remove automatic loading on mount
  // Only load when explicitly called after project selection
  const loadFeaturesFromStorage = useCallback(async () => {
    if (!activeProject) {
      console.log('No active project, skipping feature load');
      return;
    }
    // ... rest of loading logic
  }, [activeProject]);

  return (
    <MapContext.Provider
      value={{
        features,
        isMapReady,
        setIsMapReady,
        addPoint,
        addLine,
        updateFeature,
        removeFeature,
        clearFeatures,
        renderFeature,
        previewFeature,
        refreshFeatures
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export default MapProvider;