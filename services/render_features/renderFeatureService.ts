import { Position } from "@/types/collection.types";
import { Alert } from "react-native";
import { FeatureType } from "@/types/features.types";

export const renderFeatureService = {
  createLineFeature(position: Position, featureId: string | number) {
    return {
      type: 'line' as FeatureType,
      coordinates: [[position.longitude, position.latitude]] as [number, number][],
      properties: {
        featureId
      }
    };
  },

  handleCollectionError(error: string) {
    Alert.alert('Error', error);
  }
};