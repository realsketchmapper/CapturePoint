import { useFeature } from './useFeature';

export const useFeatureList = () => {
  const { features, isLoading, error, refreshFeatures } = useFeature();
  
  return {
    features,
    isLoading,
    error,
    refreshFeatures
  };
};