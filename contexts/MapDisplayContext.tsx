import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Feature, Point, LineString, FeatureCollection, GeoJsonProperties } from 'geojson';
import { FeatureToRender, FeatureType } from '@/types/features.types';
import { MapContextType, Coordinate } from '@/types/map.types';
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
      const features = await Promise.all(storedPoints.map(async (point: PointCollected) => {
        // Get the feature type
        const featureType = await storageService.getFeatureTypeByName(point.attributes.featureTypeName, point.project_id);
        if (!featureType) {
          console.warn(`Feature type ${point.attributes.featureTypeName} not found for point ${point.client_id}`);
          return null;
        }

        // Get the feature properties from attributes
        const featureName = point.attributes.name || featureType.name;
        const color = point.attributes.style?.color || featureType.color || '#FF6B00';

        const properties = {
          client_id: point.client_id,
          name: featureName,
          category: featureType.category,
          color,
          is_active: point.is_active,
          featureType,
          ...point.attributes  // Include all other attributes
        };

        const feature: Feature<Point, GeoJsonProperties> = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: point.coordinates
          },
          properties
        };

        return feature;
      }));

      // Filter out null features and log the final features for debugging
      const validFeatures = features.filter((f): f is Feature<Point, GeoJsonProperties> => f !== null);
      console.log('Loaded features:', validFeatures.map(f => ({
        client_id: f.properties?.client_id,
        type: f.geometry.type,
        name: f.properties?.name,
        category: f.properties?.category
      })));
      
      setFeatures({
        type: 'FeatureCollection',
        features: validFeatures
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

    setFeatures(prev => ({
      type: 'FeatureCollection',
      features: [...prev.features, feature]
    }));

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
    
    setFeatures((prev) => {
      const newFeatures = [...prev.features, lineFeature];
      return {
        type: 'FeatureCollection',
        features: newFeatures
      } as FeatureCollection;
    });

    return client_id;
  }, [isValidCoords]);

  // Update an existing feature
  const updateFeature = useCallback((client_id: string, coordinates: Coordinate | Coordinate[]) => {
    if (!isValidCoords(coordinates)) {
      console.warn('Invalid coordinates provided to updateFeature');
      return;
    }
    
    setFeatures((prev) => {
      const updatedFeatures = prev.features.map(feature => {
        if (feature.properties?.client_id === client_id) {
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
  const removeFeature = useCallback((client_id: string) => {
    setFeatures((prev) => {
      const filteredFeatures = prev.features.filter(feature => feature.properties?.client_id !== client_id);
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
    
    if (type.geometryType === 'Point') {
      return addPoint(coordinates as Coordinate, previewProps);
    } else if (type.geometryType === 'Line' || type.geometryType === 'Polygon') {
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