import type { GeoJsonProperties } from 'geojson';
import { ReactNode } from 'react';
import { PointCollected } from './pointCollected.types';

// Geometry types for features
export type GeometryType = 'Point' | 'Line' | 'Polygon';

// Categories of utilities
export type UtilityCategory = 'Water' | 'Electric' | 'Com' | 'Gas' | 'Other';

// Definition of a type of feature that can be collected
export interface FeatureType {
    id: number;              // Server-side ID for the feature type
    name: string;             // e.g. "Water Manhole", "Electric Line"
    category: UtilityCategory;// e.g. "Water", "Electric", "Com"
    geometryType: GeometryType;// The type of geometry this feature uses
    image_url?: string;       // Icon for point features
    svg?: string;             // Line/polygon styling
    color: string;            // Default color for the feature
    line_weight?: number;     // For line features
    dash_pattern?: string;    // For line features
    z_value: number;          // Drawing order
    draw_layer: string;       // Layer for grouping in UI
    is_active: boolean;       // Whether this feature type is available
    attributes: {             // Additional attributes specific to this type
        [key: string]: any;
    };
}

// For features that have been collected
export interface CollectedFeature {
    id: number | null;        // Server-side ID, null if unsynced
    client_id: string;        // Local ID for sync
    featureTypeId: number;    // References the FeatureType
    featureType: FeatureType; // The full feature type object
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

// For rendering features on the map
export interface FeatureToRender {
    type: GeometryType;
    coordinates: [number, number] | [number, number][];
    properties: {
        featureId: number;
        featureTypeId: number;
        name: string;
        category: UtilityCategory;
        color?: string;
        style?: any;
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
