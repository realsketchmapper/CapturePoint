import { GGAData, GSTData } from "./nmea.types";
import { FeatureType } from "./features.types";

export interface PointCollected {
  feature_name: string;
  client_id: string;
  fcode: string;
  coordinates: [number, number];  // This represents the coords Geometry('Point') from the DB
  attributes: {
    nmeaData?: {  // Moving NMEA data under attributes
      gga: GGAData;
      gst: GSTData;
    };
    [key: string]: any;  // Allow for other dynamic attributes
  };
  project_id: number;
  feature_id: string;  // References the CollectedFeature this point belongs to (using client_id)
  is_active: boolean;
  is_synced: boolean;  // Track sync status
  
  // Audit fields
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
}