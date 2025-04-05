import { BasemapStyle } from '@/src/types/settings.types';

/**
 * Map style configurations for different basemap types
 * Each style includes version, sources, and layers configuration
 */
export const basemapStyles = {
  satellite: {
    version: 8,
    sources: {
      'satellite-tiles': {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite-tiles',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  },
  streets: {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
} as const;

/**
 * Retrieves the map style configuration for a given basemap style
 * @param style - The basemap style to retrieve ('satellite' or 'streets')
 * @returns The map style configuration object
 */
export const getMapStyle = (style: BasemapStyle): typeof basemapStyles[BasemapStyle] => {
  return basemapStyles[style];
}; 