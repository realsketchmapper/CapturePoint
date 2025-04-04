import type { GeoJsonProperties } from 'geojson';
import type { FeatureTypeGeometry } from './featureType.types';

export type FeatureToRender = {
    type: FeatureTypeGeometry;
    coordinates: [number, number] | [number, number][];
    properties?: GeoJsonProperties;
};