import { UtilityCategory, GeometryType } from "./features.types";

export interface ServerFeature {
  id: number;
  client_id: string;
  featureTypeId: number;
  project_id: number;
  attributes: Record<string, any>;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
  points?: ServerPoint[];
}

export interface ServerFeatureType {
  id: number;
  name: string;
  category: UtilityCategory;
  geometryType: GeometryType;
  image_url?: string;
  svg?: string;
  color: string;
  line_weight?: number;
  dash_pattern?: string;
  z_value: number;
  draw_layer: string;
  is_active: boolean;
  attributes: Record<string, any>;
}

export interface ServerPoint {
  id: number;
  client_id: string;
  fcode: string;
  coords: [number, number];
  attributes: Record<string, any>;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
} 