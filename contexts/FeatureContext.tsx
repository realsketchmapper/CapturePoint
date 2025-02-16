import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { Feature, FeatureContextType } from '@/types/features.types';
import { FeaturesService } from '@/services/features/featuresService';

export const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

interface FeatureProviderProps {
  children: ReactNode;
}

export const FeatureProvider: React.FC<FeatureProviderProps> = ({ children }) => {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLayer = (layerName: string) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerName)) {
        newSet.delete(layerName);
      } else {
        newSet.add(layerName);
      }
      return newSet;
    });
  };

  const fetchFeatures = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await FeaturesService.getFeatures();
      setFeatures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch features');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FeatureContext.Provider 
      value={{ 
        selectedFeature, 
        setSelectedFeature, 
        expandedLayers, 
        toggleLayer,
        features,
        isLoading,
        error,
        refreshFeatures: fetchFeatures
      }}
    >
      {children}
    </FeatureContext.Provider>
  );
};