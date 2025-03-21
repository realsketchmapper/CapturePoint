import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Feature, Point, LineString, FeatureCollection, GeoJsonProperties } from 'geojson';
import { FeatureToRender } from '@/types/features.types';
import { MapContextType, Coordinate, FeatureType } from '@/types/map.types';
import { generateId } from '@/utils/collections';
import { LINE_POINT_FEATURE } from '@/constants/features';
import { storageService } from '@/services/storage/storageService';
import { PointCollected } from '@/types/pointCollected.types';

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

  // Load features from storage
  const loadFeaturesFromStorage = useCallback(async () => {
    try {
      const storedPoints = await storageService.getAllPoints();
      console.log('Loading features from storage:', storedPoints.length);
      
      // Convert stored points to GeoJSON features
      const features = storedPoints.map((point: PointCollected) => {
        // Get the feature type properties
        const featureType = point.featureType;
        const featureName = point.name;
        const isLinePoint = point.properties?.isLinePoint || false;
        const color = point.properties?.style?.color || '#FF6B00';

        // Log the point data for debugging
        console.log('Loading point:', {
          id: point.id,
          featureType,
          name: featureName,
          properties: point.properties
        });

        return {
          type: 'Feature' as const,
          id: point.id,
          geometry: {
            type: 'Point' as const,
            coordinates: point.coordinates
          },
          properties: {
            featureId: point.id,
            name: featureName,
            type: featureType, // Use type for consistency with feature types
            color,
            isLinePoint,
            ...point.properties // Keep any other properties, but after our explicit ones
          }
        };
      });

      // Log the final features for debugging
      console.log('Loaded features:', features.map(f => ({
        id: f.id,
        type: f.properties?.type,
        name: f.properties?.name,
        isLinePoint: f.properties?.isLinePoint
      })));
      
      setFeatures({
        type: 'FeatureCollection',
        features
      });
    } catch (error) {
      console.error('Error loading features from storage:', error);
    }
  }, []);

  // Expose the load function
  const refreshFeatures = useCallback(async () => {
    console.log('Refreshing features from storage...');
    await loadFeaturesFromStorage();
    console.log('Features refreshed from storage');
  }, [loadFeaturesFromStorage]);

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
    
    // Ensure we have a color property for rendering
    const pointProperties = {
      color: '#FF6B00', // Default color
      featureId: id,
      name: 'Point',
      draw_layer: 'default',
      ...(properties || {}) // Spread properties if they exist, otherwise empty object
    };
    
    const pointFeature: Feature<Point> = {
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates
      },
      properties: pointProperties
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
    
    // Create the line feature without auto-closing it
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
      previewFeature,
      refreshFeatures
    }}>
      {children}
    </MapContext.Provider>
  );
};

export default MapProvider;