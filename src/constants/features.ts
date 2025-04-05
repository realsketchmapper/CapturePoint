import { FeatureType } from '../types/featureType.types';

export const LINE_POINT_FEATURE: FeatureType = {
  svg: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
  name: 'Line Point',
  type: 'point',
  color: '#666666',
  line_weight: 1,
  dash_pattern: '',
  label: 'Line Point',
  z_value: 1,
  draw_layer: 'line_points',
  created_by: 'system',
  created_at: new Date().toISOString(),
  updated_by: 'system',
  updated_at: new Date().toISOString(),
  is_active: true,
  image_url: ''
}; 