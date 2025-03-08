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
    [key: string]: any;
  };
}