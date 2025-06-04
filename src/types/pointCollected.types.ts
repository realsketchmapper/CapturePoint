import { GGAData, GSTData, RTKProLocateData, RTKProGPSData } from "./nmea.types";
import { Position } from './collection.types';

// Common NMEA data structure used throughout
export interface NmeaData {
  gga: GGAData;
  gst: GSTData;
}

// RTK-Pro specific data structure
export interface RTKProData {
  locateData?: RTKProLocateData;
  gpsData?: RTKProGPSData;
  timestamp: string;
}

export type Coordinate = [number, number]; // [longitude, latitude]

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
    rtkProData?: RTKProData;
    formData?: { [questionId: string]: any }; // Store form responses by question ID
    [key: string]: any;  // Additional custom attributes
  };
}

// Extended version for collected points with API-specific fields
export interface PointCollected {
  // Basic point info
  client_id: string;
  name: string;
  description: string;
  draw_layer: string;
  
  // Attributes including NMEA data and RTK-Pro data
  attributes: {
    nmeaData?: NmeaData;
    rtkProData?: RTKProData;
    pointIndex?: number;  // Used for sorting points in lines
    isLinePoint?: boolean; // Flag for points that are part of a line
    parentLineId?: string; // For line points, reference to parent line
    formData?: { [questionId: string]: any }; // Store form responses by question ID
    timezone?: string; // Store timezone information
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
  parent_line_id?: string; // For line features, reference to parent line
}