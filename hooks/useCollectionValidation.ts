import { Alert } from 'react-native';
import { GGAData } from '@/types/nmea.types';
import { Feature } from '@/types/features.types';

export const useCollectionValidation = () => {
  const validateCollection = (
    selectedFeature: Feature | null,
    ggaData: GGAData | null
  ): boolean => {
    if (!selectedFeature) {
      Alert.alert('Error', 'Please select a feature first');
      return false;
    }

    if (!ggaData?.latitude || !ggaData?.longitude) {
      Alert.alert('Error', 'No valid GNSS position available');
      return false;
    }

    return true;
  };

  return { validateCollection };
};