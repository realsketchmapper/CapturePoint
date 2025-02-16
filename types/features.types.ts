export interface Feature {
    id: number;
    svg: string;
    name: string;
    type: string;
    color: string;
    line_weight: number;
    dash_pattern: string;
    label: string;
    z_value: number;
    draw_layer: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
  }
  
  export interface FeatureContextType {
    selectedFeature: Feature | null;
    setSelectedFeature: (feature: Feature | null) => void;
    expandedLayers: Set<string>;
    toggleLayer: (layerName: string) => void;
    features: Feature[];
    isLoading: boolean;
    error: string | null;
    refreshFeatures: () => Promise<void>;
  }