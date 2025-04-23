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

  // Private function to fetch feature types
  const _fetchFeatureTypes = useCallback(async (projectId: number): Promise<void> => {
    // Only fetch if we don't have feature types for this project
    if (currentProjectId === projectId && featureTypesLoaded) {
      console.log('Feature types already loaded for project:', projectId);
      return;
    }

    console.log('=== Fetching Feature Types ===');
    console.log('Project ID:', projectId);
    setIsLoading(true);
    setError(null);
    setImagesPreloaded(false); // Reset preload flag when fetching new feature types
    
    try {
      const data = await featureTypeService.fetchFeatureTypes(projectId);
      console.log('Successfully fetched feature types:', data.length);
      console.log('Feature types:', data.map(f => f.name));
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
  }, [currentProjectId, featureTypesLoaded]);

  // Public function to load feature types for a project
  const loadFeatureTypesForProject = useCallback(async (projectId: number): Promise<void> => {
    await _fetchFeatureTypes(projectId);
  }, [_fetchFeatureTypes]);

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
    console.log('=== FeatureTypeContext Debug ===');
    console.log('Looking up feature type for name:', name);
    console.log('Available feature types:', featureTypes.map(f => f.name));
    const found = featureTypes.find(f => f.name.toLowerCase() === name.toLowerCase());
    console.log('Found feature type:', found);
    return found;
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
    loadFeatureTypesForProject, // Expose loadFeatureTypesForProject instead of fetchFeatureTypes
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
    loadFeatureTypesForProject,
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