import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Feature, Point, LineString, FeatureCollection, GeoJsonProperties } from 'geojson';
import { FeatureToRender } from '@/types/features.types';
import { MapContextType, Coordinate, FeatureType } from '@/types/map.types';

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
  const [features, setFeatures] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: []
  });
  
  // Generate a simple ID
  const generateId = () => Math.random().toString(36).slice(2, 11);

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
    
    setFeatures((prev) => {
      const newFeatures = [...prev.features, pointFeature];
      return {
        type: 'FeatureCollection',
        features: newFeatures
      } as FeatureCollection;
    });

    return id;
  }, [isValidCoords]);

  // Add a line to the map
  const addLine = useCallback((coordinates: Coordinate[], properties: GeoJsonProperties = {}) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to addLine');
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
    
    setFeatures((prev) => {
      const newFeatures = [...prev.features, lineFeature];
      return {
        type: 'FeatureCollection',
        features: newFeatures
      } as FeatureCollection;
    });

    return id;
  }, [isValidCoords]);

  // Update an existing feature
  const updateFeature = useCallback((id: string, coordinates: Coordinate | Coordinate[]) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to updateFeature');
      return;
    }
    
    setFeatures((prev) => {
      const updatedFeatures = prev.features.map(feature => {
        if (feature.id === id) {
          const isPoint = feature.geometry.type === 'Point';
          
          // Create a new feature with updated coordinates
          const updatedFeature = {
            ...feature,
            geometry: {
              ...feature.geometry,
              type: isPoint ? 'Point' : 'LineString',
              coordinates
            }
          };
          
          return updatedFeature;
        }
        return feature;
      });
      
      return {
        type: 'FeatureCollection',
        features: updatedFeatures
      } as FeatureCollection;
    });
  }, [isValidCoords]);

  // Remove a feature
  const removeFeature = useCallback((id: string) => {
    setFeatures((prev) => {
      const filteredFeatures = prev.features.filter(feature => feature.id !== id);
      return {
        type: 'FeatureCollection',
        features: filteredFeatures
      } as FeatureCollection;
    });
  }, []);

  // Clear all features
  const clearFeatures = useCallback(() => {
    setFeatures({
      type: 'FeatureCollection',
      features: []
    });
  }, []);

  // Render any type of feature
  const renderFeature = useCallback((feature: FeatureToRender) => {
    if (feature.type === 'point') {
      return addPoint(feature.coordinates as Coordinate, feature.properties);
    } else if (feature.type === 'line') {
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
    
    if (type === 'point') {
      return addPoint(coordinates as Coordinate, previewProps);
    } else if (type === 'line') {
      return addLine(coordinates as Coordinate[], previewProps);
    }
    
    return null;
  }, [addPoint, addLine]);

  return (
    <MapContext.Provider value={{
      addPoint,
      addLine,
      updateFeature,
      removeFeature,
      clearFeatures,
      features,
      isMapReady,
      setIsMapReady,
      renderFeature,
      previewFeature
    }}>
      {children}
    </MapContext.Provider>
  );
};

export default MapProvider;