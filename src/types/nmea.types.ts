import { ViewStyle, TextStyle } from "react-native";

export interface GGAData {
  time: string;
  latitude: number | null;  // Updated to handle null
  longitude: number | null; // Updated to handle null
  quality: number;
  satellites: number;
  hdop: number;
  altitude: number;
  altitudeUnit: string;
  geoidHeight: number;
  geoidHeightUnit: string;
}

export interface GSTData {
  time: string;
  rmsTotal: number;      // RMS of residuals
  semiMajor: number;     // Error ellipse semi-major axis
  semiMinor: number;     // Error ellipse semi-minor axis
  orientation: number;    // Error ellipse orientation
  latitudeError: number; // Latitude error (sigma)
  longitudeError: number;// Longitude error (sigma)
  heightError: number;   // Height error (sigma)
}

// RTK-Pro specific data types
export interface RTKProLocateData {
  logNumber: number;
  locatorSerialNumber: string;
  locateFrequency: number; // Hertz
  measuredDepthOfUtility: number; // Metres
  measuredLocateCurrent: number; // Amperes
  measuredLocateSignalDirection: number;
  locateView: number;
  locateMode: number;
  gain: number; // Decibel
  measuredVectorOffset: number; // Metres
  vectorSeparation: number; // Metres
  compassAngle: number; // Radians
  distanceFromLastLog: number; // Metres
}

export interface RTKProGPSData {
  logNumber: number;
  locatorSerialNumber: string;
  timeUTC: string; // Time in HHMMSS.SS format
  date: string; // Date in DDMMYY format
  latitude: number; // Decimal degrees
  longitude: number; // Decimal degrees
  latitudeHemisphere: string; // N/S
  longitudeHemisphere: string; // E/W
  gpsFix: number;
  numberSatellites: number;
  positionalDilutionOfPrecision: number;
  horizontalDilutionOfPrecision: number;
  verticalDilutionOfPrecision: number;
  altitudeGeoid: number; // Metres
  geoidSeparation: number; // Metres
  standardDeviationLatitude: number; // Metres
  standardDeviationLongitude: number; // Metres
  standardDeviationAltitude: number; // Metres
}

export interface RTKProData {
  locateData?: RTKProLocateData;
  gpsData?: RTKProGPSData;
  timestamp: string;
}

export interface NMEAContextType {
  ggaData: GGAData | null;
  gstData: GSTData | null;  // Add GST data
  isListening: boolean;
  startListening: (address: string) => Promise<void>;
  stopListening: (address: string) => Promise<void>;
  error: string | null;
  getMaplibreCoordinates: () => [number, number] | null;
  getMySQLPoint: () => { longitude: number; latitude: number } | null;
}

export const NMEA_QUALITY_TYPES = {
  0: 'Invalid',
  1: 'GPS',
  2: 'DGPS',
  3: 'PPS',
  4: 'RTK',
  5: 'Float',
  6: 'Estimated',
  7: 'Manual Input',
  8: 'Simulation'
} as const;

export interface RMSDisplayProps {
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  labelStyle?: TextStyle;
}

export interface RMSValues {
  horizontal: string;
  vertical: string;
}

export interface NMEAQualityDisplayProps {
  text?: string;
  style?: object;
}
