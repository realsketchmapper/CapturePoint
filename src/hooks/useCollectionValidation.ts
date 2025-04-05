import { Alert } from 'react-native';
import { GGAData } from '@/types/nmea.types';
import { FeatureType } from '@/types/featureType.types';

/**
 * Custom hook for validating collection data
 * Provides validation for feature selection and GNSS position data
 * @returns Object containing validation functions
 */
export const useCollectionValidation = () => {
  /**
   * Validates the collection data
   * @param selectedFeature - The selected feature type to validate
   * @param ggaData - The GGA data containing GNSS position information
   * @returns Boolean indicating if the collection data is valid
   */
  const validateCollection = (
    selectedFeature: FeatureType | null,
    ggaData: GGAData | null
  ): boolean => {
    // Check if a feature is selected
    if (!selectedFeature) {
      Alert.alert('Error', 'Please select a feature first');
      return false;
    }

    // Check if valid GNSS position is available
    if (!ggaData?.latitude || !ggaData?.longitude) {
      Alert.alert('Error', 'No valid GNSS position available');
      return false;
    }

    return true;
  };

  return { validateCollection };
}; 