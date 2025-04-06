import React, { createContext, useState, ReactNode, useContext, useCallback, useEffect, useMemo } from 'react';
import { FeatureType, FeatureTypeContextType } from '@/types/featureType.types';
import { featureTypeService } from '@/services/features/featureTypeService';
import { Image } from 'react-native';

export const FeatureTypeContext = createContext<FeatureTypeContextType | undefined>(undefined);

export const FeatureTypeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedFeatureType, setSelectedFeatureType] = useState<FeatureType | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [featureTypes, setFeatureTypes] = useState<FeatureType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureTypesLoaded, setFeatureTypesLoaded] = useState(false);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);

  const toggleLayer = useCallback((layerName: string) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerName)) {
        newSet.delete(layerName);
      } else {
        newSet.add(layerName);
      }
      return newSet;
    });
  }, []);

  // Preload images when feature types are loaded
  useEffect(() => {
    if (featureTypes.length > 0 && !imagesPreloaded) {
      console.log('Preloading feature type images...');
      
      // Get all image URLs from the feature types
      const imageUrls = featureTypes
        .filter(featureType => featureType.type === 'Point' && featureType.image_url)
        .map(featureType => featureType.image_url);
      
      // Preload all images
      if (imageUrls.length > 0) {
        Promise.all(
          imageUrls.map(url => 
            new Promise((resolve) => {
              Image.prefetch(url)
                .then(() => {
                  console.log(`Preloaded image: ${url.substring(0, 30)}...`);
                  resolve(true);
                })
                .catch(err => {
                  console.warn(`Failed to preload image ${url.substring(0, 30)}...`, err);
                  resolve(false);
                });
            })
          )
        ).then(() => {
          console.log('All images preloaded');
          setImagesPreloaded(true);
        });
      } else {
        setImagesPreloaded(true);
      }
    }
  }, [featureTypes, imagesPreloaded]);

  const fetchFeatureTypes = useCallback(async (projectId: number): Promise<void> => {
    // Always fetch feature types for the project, even if already loaded
    // This ensures we have the latest data when switching projects
    console.log('Starting feature types fetch for project:', projectId);
    setIsLoading(true);
    setError(null);
    setImagesPreloaded(false); // Reset preload flag when fetching new feature types
    
    try {
      const data = await featureTypeService.fetchFeatureTypes(projectId);
      console.log('Successfully fetched feature types:', data.length);
      setFeatureTypes(data);
      setFeatureTypesLoaded(true);
      setCurrentProjectId(projectId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch feature types';
      console.error('Error fetching feature types:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearFeatureTypes = useCallback(() => {
    setFeatureTypes([]);
    setFeatureTypesLoaded(false);
    setSelectedFeatureType(null);
    setImagesPreloaded(false); // Reset preload flag when clearing feature types
    setCurrentProjectId(null);
  }, []);

  // Get a feature type by name (case-insensitive)
  const getFeatureTypeByName = useCallback((name: string): FeatureType | undefined => {
    if (!name) return undefined;
    return featureTypes.find(f => f.name.toLowerCase() === name.toLowerCase());
  }, [featureTypes]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    selectedFeatureType,
    setSelectedFeatureType,
    expandedLayers,
    toggleLayer,
    featureTypes,
    isLoading,
    error,
    fetchFeatureTypes,
    clearFeatureTypes,
    featureTypesLoaded,
    imagesPreloaded,
    currentProjectId,
    getFeatureTypeByName
  }), [
    selectedFeatureType,
    expandedLayers,
    toggleLayer,
    featureTypes,
    isLoading,
    error,
    fetchFeatureTypes,
    clearFeatureTypes,
    featureTypesLoaded,
    imagesPreloaded,
    currentProjectId,
    getFeatureTypeByName
  ]);

  return (
    <FeatureTypeContext.Provider value={contextValue}>
      {children}
    </FeatureTypeContext.Provider>
  );
};

export const useFeatureTypeContext = () => {
  const context = useContext(FeatureTypeContext);
  if (context === undefined) {
    throw new Error('useFeatureTypeContext must be used within a FeatureTypeProvider');
  }
  return context;
}; 