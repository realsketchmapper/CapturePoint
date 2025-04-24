import { PointCollected } from "./pointCollected.types";

export interface CurrentFeatureDisplayProps {
    text?: string;
    style?: object;
}

// For features that have been collected
export interface CollectedFeature {
  name: string;
  draw_layer: string;
  client_id: string;        // ID for maplibre
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

// For features returned by the API
export interface ApiFeature {
  properties: {
    client_id: string;
    points: PointCollected[];
  };
  data: {
    name: string;
    description: string;
    draw_layer: string;
  };
  featureTypeId: string | number;
  featureType: {
    name: string;
    description: string;
    draw_layer: string;
  };
  id: string | number;
  is_active: boolean;
  created_by: number;  // No longer nullable
  created_at: string;
  updated_by: number;  // No longer nullable
  updated_at: string;
}