import type { Feature, GeoJsonProperties } from 'geojson';
import { ReactNode } from 'react';

export interface FeatureType {
    id: string;           // Unique identifier
    name: string;         // Display name
    type: FeatureTypeGeometry; // Point/Polygon
    color: string;        // Color for styling
    line_weight: number; // line weight for the feature type
    dash_pattern: string; // dash pattern for the feature type
    label: string;        // Display label
    svg: string;         // SVG for icons
    draw_layer: string;   // Category/layer grouping
    z_value: number;      // Rendering order
    is_active: boolean;   // Visibility control
    image_url: string;    // URL for point markers
}
  
export interface FeatureTypeContextType {
    selectedFeatureType: FeatureType | null;
    setSelectedFeatureType: React.Dispatch<React.SetStateAction<FeatureType | null>>;
    expandedLayers: Set<string>;
    toggleLayer: (layerName: string) => void;
    featureTypes: FeatureType[];
    isLoading: boolean;
    error: string | null;
    loadFeatureTypesForProject: (projectId: number) => Promise<void>;
    clearFeatureTypes: () => void;
    featureTypesLoaded: boolean;
    imagesPreloaded: boolean;
    currentProjectId: number | null;
    getFeatureTypeByName: (name: string) => FeatureType | undefined;
}

export type FeatureTypeGeometry = 'Point' | 'Polygon';

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
