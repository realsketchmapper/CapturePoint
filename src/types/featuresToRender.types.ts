import type { GeoJsonProperties } from 'geojson';
import type { FeatureTypeGeometry } from './featureType.types';
import type { Coordinate } from './map.types';

export type FeatureToRender = {
    type: FeatureTypeGeometry;
    coordinates: Coordinate | Coordinate[];
    properties?: GeoJsonProperties;
};