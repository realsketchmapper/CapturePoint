import { useContext } from 'react';
import { FeatureContext } from '@/contexts/FeatureContext';
import { FeatureContextType } from '@/types/features.types';

export const useFeature = (): FeatureContextType => {
  const context = useContext(FeatureContext);
  
  if (!context) {
    throw new Error('useFeature must be used within a FeatureProvider');
  }
  
  return context;
};