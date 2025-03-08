import { useFeatureContext } from "@/FeatureContext";

export const useFeatureList = () => {
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