import { UtilityFeatureType } from "@/types/features.types";
import { CollectedFeature, PointCollected } from "@/types/pointCollected.types";
import { ServerFeature, ServerFeatureType, ServerPoint } from "@/types/server.types";

export const convertServerFeatureType = (serverFeatureType: ServerFeatureType): UtilityFeatureType => {
  return {
    id: serverFeatureType.id,
    name: serverFeatureType.name,
    category: serverFeatureType.category,
    geometryType: serverFeatureType.geometryType,
    image_url: serverFeatureType.image_url,
    svg: serverFeatureType.svg,
    color: serverFeatureType.color,
    line_weight: serverFeatureType.line_weight,
    dash_pattern: serverFeatureType.dash_pattern,
    z_value: serverFeatureType.z_value,
    draw_layer: serverFeatureType.draw_layer,
    is_active: serverFeatureType.is_active,
    attributes: serverFeatureType.attributes
  };
};

export const convertServerFeature = (serverFeature: ServerFeature, featureType: UtilityFeatureType): CollectedFeature => {
  const points = serverFeature.points || [];
  const convertedPoints = points.map(point => ({
    id: point.id,
    client_id: point.client_id,
    fcode: point.fcode,
    coordinates: point.coords,
    attributes: {
      featureTypeId: serverFeature.featureTypeId,
      ...point.attributes
    },
    project_id: serverFeature.project_id,
    feature_id: serverFeature.id,
    is_active: point.is_active,
    created_by: point.created_by,
    created_at: point.created_at,
    updated_by: point.updated_by,
    updated_at: point.updated_at
  } as PointCollected));

  return {
    id: serverFeature.id,
    client_id: serverFeature.client_id,
    featureTypeId: serverFeature.featureTypeId,
    featureType: featureType,
    project_id: serverFeature.project_id,
    points: convertedPoints,
    attributes: serverFeature.attributes,
    is_active: serverFeature.is_active,
    created_by: serverFeature.created_by,
    created_at: serverFeature.created_at,
    updated_by: serverFeature.updated_by,
    updated_at: serverFeature.updated_at
  };
}; 