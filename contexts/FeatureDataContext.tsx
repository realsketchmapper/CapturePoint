import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FeatureCollection, Feature, Point, GeoJsonProperties } from 'geojson';
import { storageService } from '@/services/storage/storageService';
import { PointCollected } from '@/types/pointCollected.types';
import { useProjectContext } from '@/contexts/ProjectContext';

interface FeatureDataContextType {
  features: FeatureCollection;
  isLoading: boolean;
  error: string | null;
  loadFeatures: (projectId: number) => Promise<void>;
  clearFeatures: () => void;
  refreshFeatures: () => Promise<void>;
}

const FeatureDataContext = createContext<FeatureDataContextType | undefined>(undefined);

export const useFeatureData = () => {
  const context = useContext(FeatureDataContext);
  if (!context) {
    throw new Error('useFeatureData must be used within a FeatureDataProvider');
  }
  return context;
};

export const FeatureDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeProject } = useProjectContext();

  const loadFeatures = useCallback(async (projectId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading features for project:', projectId);
      const storedPoints = await storageService.getProjectPoints(projectId);
      console.log('Retrieved points:', storedPoints.length);
      
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

      // Filter out null features
      const validFeatures = features.filter((f): f is Feature<Point, GeoJsonProperties> => f !== null);
      console.log(`Loaded ${validFeatures.length} valid features for project ${projectId}`);
      
      setFeatures({
        type: 'FeatureCollection',
        features: validFeatures
      });
    } catch (error) {
      console.error('Error loading features:', error);
      setError(error instanceof Error ? error.message : 'Failed to load features');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearFeatures = useCallback(() => {
    setFeatures({
      type: 'FeatureCollection',
      features: []
    });
  }, []);

  const refreshFeatures = useCallback(async () => {
    if (activeProject) {
      await loadFeatures(activeProject.id);
    }
  }, [activeProject, loadFeatures]);

  return (
    <FeatureDataContext.Provider
      value={{
        features,
        isLoading,
        error,
        loadFeatures,
        clearFeatures,
        refreshFeatures
      }}
    >
      {children}
    </FeatureDataContext.Provider>
  );
}; 