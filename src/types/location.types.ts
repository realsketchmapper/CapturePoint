
import { Position } from './collection.types';

export type LocationSource = 'device' | 'nmea' | null;

export interface LocationContextType {
  /**
   * Current location in [longitude, latitude] format.
   * This matches the format used by maplibre and MySQL Point objects.
   */
  currentLocation: Position | null;
  locationSource: LocationSource;
  isUsingNMEA: boolean;
  setUsingNMEA: (usingNMEA: boolean) => void;
  requestLocationPermission: () => Promise<boolean>;
  isInitialized: boolean;
}