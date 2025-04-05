import { PointCollected } from "./pointCollected.types";
export interface CurrentFeatureDisplayProps {
    text?: string;
    style?: object;
  }

  // For features that have been collected
export interface CollectedFeature {
  name: string;
  client_id: string;        // Local ID for sync
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