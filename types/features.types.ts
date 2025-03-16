import type { GeoJsonProperties } from 'geojson';
import { ReactNode } from 'react';

export interface Feature {
    id: number;
    svg: string;
    name: string;
    type: 'Point' | 'Line' | 'Polygon';
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
    image_url: string;
    coordinates: [number, number] | [number, number][];
    properties?: GeoJsonProperties;
}
  
export interface FeatureContextType {
    selectedFeature: Feature | null;
    setSelectedFeature: (feature: Feature | null) => void;
    expandedLayers: Set<string>;
    toggleLayer: (layerName: string) => void;
    features: Feature[];
    isLoading: boolean;
    error: string | null;
    fetchFeatures: (projectId: number) => Promise<void>;
    clearFeatures: () => void;
    featuresLoaded: boolean;
    imagesPreloaded: boolean;
}

export type FeatureType = 'point' | 'line' | 'polygon';

export type FeatureToRender = {
    type: 'Point' | 'Line' | 'Polygon';
    coordinates: [number, number] | [number, number][];
    properties?: GeoJsonProperties;
};

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
