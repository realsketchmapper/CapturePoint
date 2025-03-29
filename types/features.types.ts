import type { GeoJsonProperties } from 'geojson';
import { ReactNode } from 'react';
import { PointCollected } from './pointCollected.types';

// Geometry types for features
export type GeometryType = 'Point' | 'Line' | 'Polygon';

// Categories of utilities
export type UtilityCategory = 'Water' | 'Electric' | 'Com' | 'Gas' | 'Other';

// Definition of a type of feature that can be collected
export interface FeatureType {
    name: string;           // Primary identifier
    geometryType: 'Point' | 'Line' | 'Polygon';
    category: string;
    image_url?: string;
    svg?: string;
    color?: string;
    line_weight?: number;
    dash_pattern?: string;
    z_value?: number;
    draw_layer?: string;
    is_active?: boolean;
    attributes?: {
        [key: string]: any;
    };
}

// For features that have been collected
export interface CollectedFeature {
    client_id: string;
    featureTypeName: string;  // Just store the name, not the whole object
    project_id: number;
    points: PointCollected[];
    attributes: Record<string, any>;
    is_active: boolean;
    created_by: number | null;
    created_at: string;
    updated_by: number | null;
    updated_at: string;
}

// For rendering features on the map
export interface FeatureToRender {
    type: GeometryType;
    coordinates: [number, number] | [number, number][];
    properties: {
        client_id: string;
        name: string;
        category: UtilityCategory;
        color?: string;
        style?: any;
        featureType?: FeatureType;
    };
}

export interface FeatureContextType {
    selectedFeatureType: FeatureType | null;
    setSelectedFeatureType: (feature: FeatureType | null) => void;
    expandedLayers: Set<string>;
    toggleLayer: (layerName: string) => void;
    featureTypes: FeatureType[];
    isLoading: boolean;
    error: string | null;
    fetchFeatureTypes: (projectId: number) => Promise<void>;
    clearFeatureTypes: () => void;
    featuresLoaded: boolean;
    imagesPreloaded: boolean;
}

export interface FeatureProviderProps {
    children: ReactNode;
}
