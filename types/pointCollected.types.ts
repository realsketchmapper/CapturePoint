import { GGAData, GSTData } from "./nmea.types";
import { UtilityFeatureType } from "./features.types";

export interface CollectedFeature {
  id: number;               // Database ID for this specific collected feature
  client_id: string;        // Local ID for sync
  featureTypeId: number;    // References the UtilityFeatureType
  featureType: UtilityFeatureType; // The full feature type object
  project_id: number;
  points: PointCollected[];
  attributes: {             // Instance-specific attributes
    [key: string]: any;
  };
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
}

export interface PointCollected {
  id: number | null;  // null indicates unsynced point
  client_id: string;
  fcode: string;
  coordinates: [number, number];  // This represents the coords Geometry('Point') from the DB
  attributes: {
    nmeaData?: {  // Moving NMEA data under attributes
      gga: GGAData;
      gst: GSTData;
    };
    featureTypeId: number;  // Reference to the type of feature this point belongs to
    [key: string]: any;  // Allow for other dynamic attributes
  };
  project_id: number;
  feature_id: number;  // References the CollectedFeature this point belongs to
  is_active: boolean;
  
  // Audit fields
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
}