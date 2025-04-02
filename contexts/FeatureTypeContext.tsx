import React, { createContext, useState, ReactNode, useContext, useCallback, useEffect, useMemo } from 'react';
import { FeatureType, FeatureTypeContextType } from '@/types/features.types';
import { featureTypeService } from '@/services/features/featureTypeService';
import { Image } from 'react-native';
import { FeatureProviderProps } from '@/types/features.types';
import { storageService } from '@/services/storage/storageService';

export const FeatureTypeContext = createContext<FeatureTypeContextType | undefined>(undefined);

export const useFeatureTypeContext = () => {
  const context = useContext(FeatureTypeContext);
  if (!context) {
    throw new Error('useFeatureTypeContext must be used within a FeatureTypeProvider');
  }
  return context;
};

export const FeatureTypeProvider: React.FC<FeatureProviderProps> = ({ children }) => {
  const [selectedFeatureType, setSelectedFeatureType] = useState<FeatureType | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [featureTypes, setFeatureTypes] = useState<FeatureType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

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

  // Preload images when features are loaded
  useEffect(() => {
    if (featureTypes.length > 0 && !imagesPreloaded) {
      console.log('Preloading feature type images...');
      
      // Get all image URLs from the feature types
      const imageUrls = featureTypes
        .filter(featureType => featureType.geometryType === 'Point' && featureType.image_url)
        .map(featureType => featureType.image_url as string);
      
      console.log(`Found ${imageUrls.length} image URLs to preload`);
      
      // Preload all images
      if (imageUrls.length > 0) {
        Promise.all(
          imageUrls.map(url => 
            new Promise((resolve) => {
              Image.prefetch(url)
                .then(() => {
                  resolve(true);
                })
                .catch(err => {
                  console.warn(`Failed to preload image ${url}:`, err);
                  resolve(false);
                });
            })
          )
        ).then(() => {
          console.log('All images preloaded');
          setImagesPreloaded(true);
        });
      } else {
        console.log('No images to preload');
        setImagesPreloaded(true);
      }
    }
  }, [featureTypes, imagesPreloaded]);

  const fetchFeatureTypes = useCallback(async (projectId: number) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching feature types from server...');
      const fetchedFeatureTypes = await featureTypeService.fetchFeatureTypes(projectId);
      
      // Save feature types to AsyncStorage
      await storageService.saveFeatureTypes(fetchedFeatureTypes, projectId);
      
      console.log(`Fetched ${fetchedFeatureTypes.length} feature types`);
      setFeatureTypes(fetchedFeatureTypes);
      setFeaturesLoaded(true);
    } catch (err) {
      // If server fetch fails, try loading from storage as fallback
      console.log('Server fetch failed, attempting to load from storage...');
      const storedTypes = await storageService.getFeatureTypes(projectId);
      
      if (storedTypes && storedTypes.length > 0) {
        console.log(`Loaded ${storedTypes.length} feature types from storage as fallback`);
        setFeatureTypes(storedTypes);
        setFeaturesLoaded(true);
        return;
      }

      setError(err instanceof Error ? err.message : 'Failed to fetch feature types');
      console.error('Error fetching feature types:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearFeatureTypes = useCallback(() => {
    setFeatureTypes([]);
    setFeaturesLoaded(false);
    setImagesPreloaded(false);
  }, []);

  return (
    <FeatureTypeContext.Provider
      value={{
        selectedFeatureType,
        setSelectedFeatureType,
        expandedLayers,
        toggleLayer,
        featureTypes,
        isLoading,
        error,
        fetchFeatureTypes,
        clearFeatureTypes,
        featuresLoaded,
        imagesPreloaded
      }}
    >
      {children}
    </FeatureTypeContext.Provider>
  );
};