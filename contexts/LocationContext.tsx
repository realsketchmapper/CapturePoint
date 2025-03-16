import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useNMEAContext } from '@/contexts/NMEAContext';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationContextType, LocationSource } from '@/types/location.types';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  LOCATION_PERMISSION: 'locationPermission',
  HIGH_ACCURACY: 'locationHighAccuracy'
} as const;

// Location settings for high accuracy
const LOCATION_SETTINGS = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0.1, // Update every 0.1 meters
  mayShowUserSettingsDialog: false // We'll handle this manually
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ggaData } = useNMEAContext();
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);
  const [isUsingNMEA, setIsUsingNMEA] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const locationWatcher = useRef<{ remove: () => void } | null>(null);

  // Initialize location services
  const initializeLocation = useCallback(async () => {
    try {
      const hasPermission = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_PERMISSION);
      if (hasPermission === 'true') {
        await startLocationUpdates();
      }
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing location:', error);
      setIsInitialized(true);
    }
  }, []);

  // Enable high accuracy mode if not already set
  const enableHighAccuracy = useCallback(async () => {
    try {
      const hasHighAccuracy = await AsyncStorage.getItem(STORAGE_KEYS.HIGH_ACCURACY);
      if (hasHighAccuracy === null) {
        // First time, try to enable and save preference
        await Location.enableNetworkProviderAsync();
        await AsyncStorage.setItem(STORAGE_KEYS.HIGH_ACCURACY, 'true');
      } else if (hasHighAccuracy === 'true') {
        // Re-enable if previously enabled
        await Location.enableNetworkProviderAsync();
      }
    } catch (error) {
      // If user denies or there's an error, save the preference as false
      await AsyncStorage.setItem(STORAGE_KEYS.HIGH_ACCURACY, 'false');
      console.log('Could not enable high accuracy mode:', error);
    }
  }, []);

  // Start location updates
  const startLocationUpdates = useCallback(async () => {
    try {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
      
      if (foregroundStatus === 'granted' && backgroundStatus === 'granted') {
        // Try to enable high accuracy if not already set
        await enableHighAccuracy();

        // Get initial location with high accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: LOCATION_SETTINGS.accuracy
        });
        
        if (!isUsingNMEA) {
          setCurrentLocation([location.coords.longitude, location.coords.latitude]);
          setLocationSource('device');
        }
        
        // Remove any existing watcher
        if (locationWatcher.current) {
          locationWatcher.current.remove();
        }
        
        // Start watching position with high accuracy
        const watcher = await Location.watchPositionAsync(
          LOCATION_SETTINGS,
          (location) => {
            if (!isUsingNMEA) {
              setCurrentLocation([location.coords.longitude, location.coords.latitude]);
              setLocationSource('device');
            }
          }
        );
        
        locationWatcher.current = watcher;
      }
    } catch (error) {
      console.error('Error starting location updates:', error);
    }
  }, [isUsingNMEA, enableHighAccuracy]);

  // Request location permissions
  const requestLocationPermission = useCallback(async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus === 'granted') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        const granted = backgroundStatus === 'granted';
        await AsyncStorage.setItem(STORAGE_KEYS.LOCATION_PERMISSION, granted.toString());
        
        if (granted) {
          await startLocationUpdates();
        }
        return granted;
      }
      return false;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }, [startLocationUpdates]);

  // Handle NMEA data updates
  const handleNMEAData = useCallback(() => {
    if (ggaData && ggaData.latitude !== null && ggaData.longitude !== null) {
      setCurrentLocation([ggaData.longitude, ggaData.latitude]);
      setLocationSource('nmea');
    }
  }, [ggaData]);

  // Initialize on mount
  React.useEffect(() => {
    initializeLocation();
    
    // Cleanup function
    return () => {
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
    };
  }, [initializeLocation]);

  // Handle NMEA data changes
  React.useEffect(() => {
    if (isUsingNMEA) {
      handleNMEAData();
    }
  }, [handleNMEAData, isUsingNMEA]);

  const setUsingNMEA = useCallback((usingNMEA: boolean) => {
    setIsUsingNMEA(usingNMEA);
    if (!usingNMEA) {
      // When switching back to GPS, restart location updates
      startLocationUpdates();
    } else {
      // When switching to NMEA, remove the GPS watcher
      if (locationWatcher.current) {
        locationWatcher.current.remove();
        locationWatcher.current = null;
      }
    }
  }, [startLocationUpdates]);
  
  return (
    <LocationContext.Provider value={{
      currentLocation,
      locationSource,
      isUsingNMEA,
      setUsingNMEA,
      requestLocationPermission,
      isInitialized,
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