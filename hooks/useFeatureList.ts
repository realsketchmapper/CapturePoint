import { useFeatureTypeContext } from "@/contexts/FeatureTypeContext";

export const useFeatureList = () => {
    const { 
      features, 
      isLoading, 
      error, 
      fetchFeatures,
      featuresLoaded 
    } = useFeatureTypeContext();
    
    return {
      features,
      isLoading,
      error,
      refreshFeatures: fetchFeatures,
      featuresLoaded
    };
  };