export interface ServerPoint {
  id: number;
  client_id: string;
  fcode: string;
  coords: {
    type: 'Point';
    coordinates: [number, number];
  };
  attributes: {
    [key: string]: any;
  };
  project_id: number;
  feature_id: number;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
} 