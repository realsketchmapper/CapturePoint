import { useFeatureContext } from "@/src/contexts/FeatureContext";

/**
 * Custom hook for accessing feature list functionality
 * Provides a simplified interface for working with features
 * @returns Object containing feature list state and functions
 */
export const useFeatureTypesList = () => {
  const { 
    features, 
    isLoading, 
    error, 
    fetchFeatures,
    featuresLoaded 
  } = useFeatureContext();
  
  return {
    features,
    isLoading,
    error,
    refreshFeatures: fetchFeatures,
    featuresLoaded
  };
}; 