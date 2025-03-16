import { LocationObject } from 'expo-location';

export type LocationSource = 'device' | 'nmea' | null;

export interface LocationContextType {
  currentLocation: [number, number] | null;
  locationSource: LocationSource;
  isUsingNMEA: boolean;
  setUsingNMEA: (usingNMEA: boolean) => void;
  requestLocationPermission: () => Promise<boolean>;
  isInitialized: boolean;
}