// mapContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import MapLibreGL, { CameraRef } from '@maplibre/maplibre-react-native';
import type { 
  Feature, 
  Point, 
  LineString, 
  FeatureCollection,
  GeoJsonProperties 
} from 'geojson';
import { MapFeature, CameraOptions, MapContextType } from '@/types/map.types';
import { FeatureToRender } from '@/types/features.types';

const MapContext = createContext<MapContextType | undefined>(undefined);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (context === undefined) {
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
  
  const featureMap = useRef(new Map<string, MapFeature>());
  const cameraRef = useRef<CameraRef>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addPoint = useCallback((coordinates: [number, number], properties: GeoJsonProperties = {}) => {
    const id = generateId();
    const feature: MapFeature = { id, coordinates, type: 'point', properties };
    featureMap.current.set(id, feature);

    setFeatures(prev => ({
      type: 'FeatureCollection',
      features: [...prev.features, {
        type: 'Feature',
        id,
        geometry: {
          type: 'Point',
          coordinates
        } as Point,
        properties
      } as Feature<Point>]
    }));

    return id;
  }, []);

  const addLine = useCallback((coordinates: [number, number][], properties: GeoJsonProperties = {}) => {
    const id = generateId();
    const feature: MapFeature = { id, coordinates, type: 'line', properties };
    featureMap.current.set(id, feature);

    setFeatures(prev => ({
      type: 'FeatureCollection',
      features: [...prev.features, {
        type: 'Feature',
        id,
        geometry: {
          type: 'LineString',
          coordinates
        } as LineString,
        properties
      } as Feature<LineString>]
    }));

    return id;
  }, []);

  const updateFeature = useCallback((id: string, coordinates: [number, number] | [number, number][]) => {
    const feature = featureMap.current.get(id);
    if (!feature) return;

    feature.coordinates = coordinates;
    
    setFeatures(prev => ({
      type: 'FeatureCollection',
      features: prev.features.map(f => {
        if (f.id === id) {
          return {
            type: 'Feature',
            id: f.id,
            geometry: {
              type: feature.type === 'point' ? 'Point' : 'LineString',
              coordinates
            } as Point | LineString,
            properties: f.properties
          } as Feature<Point | LineString>;
        }
        return f;
      })
    }));
  }, []);

  const removeFeature = useCallback((id: string) => {
    featureMap.current.delete(id);
    
    setFeatures(prev => ({
      type: 'FeatureCollection',
      features: prev.features.filter(f => f.id !== id)
    }));
  }, []);

  const clearFeatures = useCallback(() => {
    featureMap.current.clear();
    setFeatures({
      type: 'FeatureCollection',
      features: []
    });
  }, []);

  const setCamera = useCallback((options: CameraOptions) => {
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: options.centerCoordinate,
        zoomLevel: options.zoomLevel,
        animationDuration: options.animationDuration ?? 500
      });
    }
  }, []);

  const renderFeature = useCallback((feature: FeatureToRender) => {
    if (feature.type === 'point') {
      return addPoint(feature.coordinates as [number, number], feature.properties);
    } else if (feature.type === 'line') {
      return addLine(feature.coordinates as [number, number][], feature.properties);
    }
    throw new Error(`Unsupported feature type: ${feature.type}`);
  }, [addPoint, addLine]);

  const previewFeature = useCallback((coordinates: [number, number] | [number, number][], type: 'point' | 'line' | 'polygon') => {
    const previewProperties = { isPreview: true };
    if (type === 'point') {
      return addPoint(coordinates as [number, number], previewProperties);
    } else if (type === 'line') {
      return addLine(coordinates as [number, number][], previewProperties);
    }
    throw new Error(`Unsupported preview type: ${type}`);
  }, [addPoint, addLine]);

  return (
    <MapContext.Provider value={{
      addPoint,
      addLine,
      updateFeature,
      removeFeature,
      clearFeatures,
      setCamera,
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