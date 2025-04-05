import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { useNMEAContext } from '@/contexts/NMEAContext';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationContextType, LocationSource } from '@/src/types/location.types';
import { Position } from '@/src/types/collection.types';

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

// Define action types
type LocationAction = 
  | { type: 'SET_CURRENT_LOCATION'; payload: Position | null }
  | { type: 'SET_LOCATION_SOURCE'; payload: LocationSource }
  | { type: 'SET_USING_NMEA'; payload: boolean }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// Define initial state
interface LocationState {
  currentLocation: Position | null;
  locationSource: LocationSource;
  isUsingNMEA: boolean;
  isInitialized: boolean;
  error: string | null;
}

const initialState: LocationState = {
  currentLocation: null,
  locationSource: null,
  isUsingNMEA: false,
  isInitialized: false,
  error: null
};

// Reducer function
function locationReducer(state: LocationState, action: LocationAction): LocationState {
  switch (action.type) {
    case 'SET_CURRENT_LOCATION':
      return { 
        ...state, 
        currentLocation: action.payload 
      };
    case 'SET_LOCATION_SOURCE':
      return { 
        ...state, 
        locationSource: action.payload 
      };
    case 'SET_USING_NMEA':
      return { 
        ...state, 
        isUsingNMEA: action.payload 
      };
    case 'SET_INITIALIZED':
      return { 
        ...state, 
        isInitialized: action.payload 
      };
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload 
      };
    default:
      return state;
  }
}

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ggaData } = useNMEAContext();
  const [state, dispatch] = useReducer(locationReducer, initialState);
  const locationWatcher = useRef<{ remove: () => void } | null>(null);

  // Initialize location services
  const initializeLocation = useCallback(async () => {
    try {
      const hasPermission = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_PERMISSION);
      if (hasPermission === 'true') {
        await startLocationUpdates();
      }
      dispatch({ type: 'SET_INITIALIZED', payload: true });
    } catch (error) {
      console.error('Error initializing location:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize location services' });
      dispatch({ type: 'SET_INITIALIZED', payload: true });
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
      dispatch({ type: 'SET_ERROR', payload: 'Could not enable high accuracy mode' });
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
        
        if (!state.isUsingNMEA) {
          dispatch({ 
            type: 'SET_CURRENT_LOCATION', 
            payload: [location.coords.longitude, location.coords.latitude] 
          });
          dispatch({ type: 'SET_LOCATION_SOURCE', payload: 'device' });
        }
        
        // Remove any existing watcher
        if (locationWatcher.current) {
          locationWatcher.current.remove();
        }
        
        // Start watching position with high accuracy
        const watcher = await Location.watchPositionAsync(
          LOCATION_SETTINGS,
          (location) => {
            if (!state.isUsingNMEA) {
              dispatch({ 
                type: 'SET_CURRENT_LOCATION', 
                payload: [location.coords.longitude, location.coords.latitude] 
              });
              dispatch({ type: 'SET_LOCATION_SOURCE', payload: 'device' });
            }
          }
        );
        
        locationWatcher.current = watcher;
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Location permissions not granted' });
      }
    } catch (error) {
      console.error('Error starting location updates:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start location updates' });
    }
  }, [state.isUsingNMEA, enableHighAccuracy]);

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
        } else {
          dispatch({ type: 'SET_ERROR', payload: 'Background location permission denied' });
        }
        return granted;
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Foreground location permission denied' });
        return false;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to request location permissions' });
      return false;
    }
  }, [startLocationUpdates]);

  // Handle NMEA data updates
  const handleNMEAData = useCallback(() => {
    if (ggaData && ggaData.latitude !== null && ggaData.longitude !== null) {
      dispatch({ 
        type: 'SET_CURRENT_LOCATION', 
        payload: [ggaData.longitude, ggaData.latitude] 
      });
      dispatch({ type: 'SET_LOCATION_SOURCE', payload: 'nmea' });
    }
  }, [ggaData]);

  // Initialize on mount
  useEffect(() => {
    initializeLocation();
    
    // Cleanup function
    return () => {
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
    };
  }, [initializeLocation]);

  // Handle NMEA data changes
  useEffect(() => {
    if (state.isUsingNMEA) {
      handleNMEAData();
    }
  }, [handleNMEAData, state.isUsingNMEA]);

  const setUsingNMEA = useCallback((usingNMEA: boolean) => {
    dispatch({ type: 'SET_USING_NMEA', payload: usingNMEA });
    
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
      currentLocation: state.currentLocation,
      locationSource: state.locationSource,
      isUsingNMEA: state.isUsingNMEA,
      setUsingNMEA,
      requestLocationPermission,
      isInitialized: state.isInitialized,
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