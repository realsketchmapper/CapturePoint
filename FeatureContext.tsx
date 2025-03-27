import React, { createContext, useState, ReactNode, useContext, useCallback, useEffect, useMemo } from 'react';
import { Feature, FeatureContextType } from '@/types/features.types';
import { featureTypeService } from '@/services/features/featureTypeService';
import { Image } from 'react-native';
import { FeatureProviderProps } from '@/types/features.types';

export const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<FeatureProviderProps> = ({ children }) => {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [features, setFeatures] = useState<Feature[]>([]);
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
    if (features.length > 0 && !imagesPreloaded) {
      console.log('Preloading feature images...');
      
      // Get all image URLs from the features
      const imageUrls = features
        .filter(feature => feature.type === 'Point' && feature.image_url)
        .map(feature => feature.image_url as string);
      
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
  }, [features, imagesPreloaded]);

  const fetchFeatures = useCallback(async (projectId: number): Promise<void> => {
    if (featuresLoaded) return;
    
    setIsLoading(true);
    setError(null);
    setImagesPreloaded(false); // Reset preload flag when fetching new features
    
    try {
      const data = await featureTypeService.fetchProjectFeatures(projectId);
      setFeatures(data);
      setFeaturesLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch features');
    } finally {
      setIsLoading(false);
    }
  }, [featuresLoaded]);

  const clearFeatures = useCallback(() => {
    setFeatures([]);
    setFeaturesLoaded(false);
    setSelectedFeature(null);
    setImagesPreloaded(false); // Reset preload flag when clearing features
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    selectedFeature,
    setSelectedFeature,
    expandedLayers,
    toggleLayer,
    features,
    isLoading,
    error,
    fetchFeatures,
    clearFeatures,
    featuresLoaded,
    imagesPreloaded
  }), [
    selectedFeature,
    expandedLayers,
    toggleLayer,
    features,
    isLoading,
    error,
    fetchFeatures,
    clearFeatures,
    featuresLoaded,
    imagesPreloaded
  ]);

  return (
    <FeatureContext.Provider value={contextValue}>
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatureContext = () => {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatureContext must be used within a FeatureProvider');
  }
  return context;
};