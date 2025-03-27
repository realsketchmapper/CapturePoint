// constants/features.ts
import { FeatureType } from '@/types/features.types';

// Small circle SVG for line points - using a template string to allow dynamic color
export const getLinePointSvg = (color = '#FF6B00') => {
  // Ensure color has # prefix if it's a hex color without it
  const formattedColor = color.startsWith('#') ? color : `#${color}`;
  
  return `
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="8" cy="8" r="5" fill="${formattedColor}" />
  <circle cx="8" cy="8" r="5" stroke="white" stroke-width="1" />
</svg>
`;
};

// Default orange dot SVG for preview purposes only
const DEFAULT_DOT_SVG = getLinePointSvg('#FF6B00');

// Internal feature type definition for line vertex points
export const LINE_POINT_FEATURE: FeatureType = {
  id: -1, // Internal feature type ID
  name: 'Line Point',
  category: 'Other',
  geometryType: 'Point',
  draw_layer: 'default',
  svg: DEFAULT_DOT_SVG, // Default SVG is only used for preview/fallback
  image_url: undefined,
  color: '#FF6B00',
  z_value: 0,
  is_active: true,
  attributes: {
    isInternal: true // Flag to identify this as an internal feature type
  }
};