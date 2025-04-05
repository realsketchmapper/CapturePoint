import { GGAData, GSTData } from "./nmea.types";

export interface PointCollected {
  id: string;
  name: string,
  description: string;
  nmeaData: {
    gga: GGAData;
    gst: GSTData;
  };
  attributes?: {
    [key: string]: any;  // Additional custom attributes that can be added dynamically
  };
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
  synced: boolean;
  feature_id: number;
  projectId: number;
}