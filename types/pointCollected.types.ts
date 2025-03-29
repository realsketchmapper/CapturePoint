import { GGAData, GSTData } from "./nmea.types";
import { FeatureType } from "./features.types";

export interface PointCollected {
  client_id: string | null;  // Allow null for unsynced points
  fcode: string;
  coordinates: [number, number];  // This represents the coords Geometry('Point') from the DB
  attributes: {
    nmeaData?: {  // Moving NMEA data under attributes
      gga: any;
      gst: any;
    };
    name: string;
    category: string;
    type?: string;  // Optional type property
    style?: any;
    description?: string;  // Optional description field
    [key: string]: any;  // Allow additional properties
  };
  project_id: number;
  is_active: boolean;
  is_synced: boolean;  // Track sync status
  
  // Audit fields
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
}