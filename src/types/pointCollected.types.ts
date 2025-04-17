import { GGAData, GSTData } from "./nmea.types";

// Common NMEA data structure used throughout
export interface NmeaData {
  gga: GGAData;
  gst: GSTData;
}

// Structure for a single point
export interface PointData {
  client_id: string;
  coords: [number, number];
  created_at: string;
  created_by: number;
  fcode: string;
  is_active: boolean;
  updated_at: string;
  updated_by: number;
  attributes?: {
    nmeaData?: NmeaData;
    [key: string]: any;  // Additional custom attributes
  };
}

export interface PointCollected {
  // Basic point info
  client_id: string;
  name: string;
  description: string;
  draw_layer: string;
  
  // Attributes including NMEA data
  attributes?: {
    nmeaData?: NmeaData;
    [key: string]: any;  // Additional custom attributes
  };
  
  // For server-synced points
  points?: PointData[];
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
  synced: boolean;
  feature_id: number;
  project_id: number;
}