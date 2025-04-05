import { useFeatureTypeContext } from "@/contexts/FeatureTypeContext";

/**
 * Custom hook for accessing feature list functionality
 * Provides a simplified interface for working with features
 * @returns Object containing feature list state and functions
 */
export const useFeatureTypesList = () => {
  const { 
    featureTypes, 
    isLoading, 
    error, 
    fetchFeatureTypes,
    featureTypesLoaded 
  } = useFeatureTypeContext();
  
  return {
    featureTypes,
    isLoading,
    error,
    refreshFeatureTypes: fetchFeatureTypes,
    featureTypesLoaded
  };
}; 