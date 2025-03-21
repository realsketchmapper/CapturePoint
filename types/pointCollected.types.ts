import { GGAData, GSTData } from "./nmea.types";

export interface PointCollected {
  id: string;
  created_at: string;
  projectId: number;
  name: string,
  featureTypeId: number;
  featureType: string; // 'Point', 'Line', or 'Polygon'
  coordinates: [number, number];
  nmeaData: {
    gga: GGAData;
    gst: GSTData;
  };
  synced: boolean;
  properties: {
    [key: string]: any;  // Dynamic properties can be added at runtime
  };
  attributes?: {
    [key: string]: any;  // Additional custom attributes that can be added dynamically
  };
  updated_at?: string;  // Add optional updated_at field
}