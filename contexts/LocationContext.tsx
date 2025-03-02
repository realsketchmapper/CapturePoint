import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { LocationContextType } from '@/types/location.types';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ggaData } = useNMEAContext();
  
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (ggaData && ggaData.latitude !== undefined && ggaData.longitude !== undefined) {
      const newLocation: [number, number] = [ggaData.longitude, ggaData.latitude];
      setCurrentLocation(newLocation);
    }
  }, [ggaData]);
  
  return (
    <LocationContext.Provider value={{
      currentLocation,
    }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};