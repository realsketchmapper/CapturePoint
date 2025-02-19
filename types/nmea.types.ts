import { ViewStyle, TextStyle } from "react-native";

export interface GGAData {
  time: string;
  latitude: number | null;
  longitude: number | null;
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

export interface NMEAContextType {
  ggaData: GGAData | null;
  gstData: GSTData | null;  // Add GST data
  isListening: boolean;
  startListening: (address: string) => Promise<void>;
  stopListening: (address: string) => Promise<void>;
  error: string | null;
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

export interface DisplayValues {
  quality: string;
  satellites: string;
}