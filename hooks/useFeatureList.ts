import { useFeature } from './useFeature';

export const useFeatureList = () => {
    const { 
      features, 
      isLoading, 
      error, 
      fetchFeatures,
      featuresLoaded 
    } = useFeature();
    
    return {
      features,
      isLoading,
      error,
      refreshFeatures: fetchFeatures,
      featuresLoaded
    };
  };