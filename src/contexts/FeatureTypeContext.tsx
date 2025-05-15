import React, { createContext, useState, ReactNode, useContext, useCallback, useEffect, useMemo } from 'react';
import { FeatureType, FeatureTypeContextType } from '@/types/featureType.types';
import { featureTypeService } from '@/services/features/featureTypeService';
import { featureTypeStorageService } from '@/services/storage/featureTypeStorageService';
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

  // Preload and cache feature type images
  useEffect(() => {
    if (featureTypes.length > 0 && !imagesPreloaded) {
      console.log('Preloading feature type images...');
      
      // Get point feature types with image URLs
      const pointFeatureTypes = featureTypes.filter(
        featureType => featureType.type === 'Point' && featureType.image_url
      );
      
      if (pointFeatureTypes.length > 0) {
        Promise.all(
          pointFeatureTypes.map(featureType => 
            new Promise<void>(async (resolve) => {
              try {
                // First check if we have a local version or store it if online
                const localUri = await featureTypeStorageService.getFeatureTypeImage(
                  featureType.image_url,
                  featureType.name
                );
                
                // Update the feature type with the local URI if different
                if (localUri !== featureType.image_url) {
                  featureType.image_url = localUri;
                }
                
                // Still try to prefetch the image to ensure it's in the React Native image cache
                const prefetchResult = await Image.prefetch(localUri);
                console.log(`Preloaded image: ${localUri.substring(0, 30)}...`);
              } catch (err) {
                console.warn(`Failed to preload image for ${featureType.name}:`, err);
              } finally {
                resolve();
              }
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
    // Clear selected feature type when loading a new project
    setSelectedFeatureType(null);
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
    
    // Extract base feature type name from point names
    let searchName = name;
    
    // Handle "Point" suffix pattern (e.g., "Elec. Line Point 1")
    if (name.includes(' Point ')) {
      const parts = name.split(' Point ');
      if (parts.length > 0 && parts[0]) {
        searchName = parts[0];
        console.log('Extracted base feature type name from Point pattern:', searchName);
      }
    }
    // Handle "Vertex" suffix pattern (e.g., "Elec. Line Vertex 1")
    else if (name.includes(' Vertex ')) {
      const parts = name.split(' Vertex ');
      if (parts.length > 0 && parts[0]) {
        searchName = parts[0];
        console.log('Extracted base feature type name from Vertex pattern:', searchName);
      }
    }
    // Handle numbered suffix pattern (e.g., "Elec. Line 1")
    else {
      // Extract everything before the last space and number
      const match = name.match(/^(.+?)(?:\s+\d+)?$/);
      if (match && match[1]) {
        // Check if what we extracted is different from the original name
        // and doesn't end with a number
        if (match[1] !== name && !match[1].match(/\d+$/)) {
          searchName = match[1];
          console.log('Extracted base feature type name from number pattern:', searchName);
        }
      }
    }
    
    // Try to find an exact match with the extracted name
    let found = featureTypes.find(f => f.name.toLowerCase() === searchName.toLowerCase());
    
    // If we don't find an exact match and the name has multiple parts,
    // try matching with just the first part (e.g., "Elec." from "Elec. Line")
    if (!found && searchName.includes(' ')) {
      const firstPart = searchName.split(' ')[0];
      const matchingType = featureTypes.find(f => 
        f.name.toLowerCase().startsWith(firstPart.toLowerCase())
      );
      
      if (matchingType) {
        console.log('Found partial match by prefix:', matchingType.name);
        found = matchingType;
      }
    }
    
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