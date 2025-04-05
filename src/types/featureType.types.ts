import type { Feature, GeoJsonProperties } from 'geojson';
import { ReactNode } from 'react';

export interface FeatureType {
    svg: string; // svg for the feature type
    name: string; // name for the feature type
    type: FeatureTypeGeometry; // type for the feature type
    color: string; // color for the feature type
    line_weight: number; // line weight for the feature type
    dash_pattern: string; // dash pattern for the feature type
    label: string; // label for the feature type
    z_value: number; // z-value for the feature type
    draw_layer: string; // draw layer for the feature type
    created_by: string; // created by for the feature type
    created_at: string; // created at for the feature type
    updated_by: string; // updated by for the feature type
    updated_at: string; // updated at for the feature type
    is_active: boolean; // is active for the feature type
    image_url: string; // image url for the feature type
}
  
export interface FeatureTypeContextType {
    selectedFeatureType: FeatureType | null;
    setSelectedFeatureType: (featureType: FeatureType | null) => void;
    expandedLayers: Set<string>;
    toggleLayer: (layerName: string) => void;
    featureTypes: FeatureType[];
    isLoading: boolean;
    error: string | null;
    fetchFeatureTypes: (projectId: number) => Promise<void>;
    clearFeatureTypes: () => void;
    featureTypesLoaded: boolean;
    imagesPreloaded: boolean;
}

export type FeatureTypeGeometry = 'Point' | 'Line' | 'Polygon';

export interface FeatureButtonProps {
    onPress: () => void;
}

export interface FeatureListModalProps {
    isVisible: boolean;
    onClose: () => void;
}

export interface FeatureProviderProps {
    children: ReactNode;
}
