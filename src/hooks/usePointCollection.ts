import { useCallback } from 'react';
import { useLocationContext } from '@/contexts/LocationContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { generateId } from '@/utils/collections';
import { getCurrentStandardizedTime } from '@/utils/datetime';

/**
 * Hook for collecting point features
 * @returns Object with point collection functions
 */
export const usePointCollection = () => {
  const { currentLocation } = useLocationContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { renderFeature, addPoint } = useMapContext();
  const { ggaData, gstData } = useNMEAContext();
  const { activeProject } = useProjectContext();
  const { user } = useAuthContext();

  /**
   * Handle point collection
   */
  const handlePointCollection = useCallback(async () => {
    if (!currentLocation || !selectedFeatureType) {
      console.warn('Cannot collect point: Missing location or feature type');
      return;
    }

    try {
      // Get coordinates in the correct format
      const coordinates: [number, number] = Array.isArray(currentLocation)
        ? currentLocation
        : [currentLocation.longitude, currentLocation.latitude];

      const clientId = generateId();

      // Create the feature to render
      const featureToRender = {
        type: 'Point' as const,
        coordinates,
        properties: {
          client_id: clientId,
          name: selectedFeatureType.name,
          featureType: selectedFeatureType,
          draw_layer: selectedFeatureType.draw_layer,
          style: {
            color: selectedFeatureType.color
          }
        }
      };

      // Render the feature on the map
      const featureId = renderFeature(featureToRender);
      
      if (!featureId) {
        console.warn('Failed to render feature');
        return;
      }

      // Save the point to storage
      await featureStorageService.savePoint({
        client_id: clientId,
        name: selectedFeatureType.name,
        description: '',
        draw_layer: selectedFeatureType.draw_layer,
        attributes: {
          nmeaData: {
            gga: ggaData || {
              time: getCurrentStandardizedTime(),
              latitude: coordinates[1],
              longitude: coordinates[0],
              quality: 1, // GPS
              satellites: 8,
              hdop: 1.0,
              altitude: 0,
              altitudeUnit: 'M',
              geoidHeight: 0,
              geoidHeightUnit: 'M'
            },
            gst: gstData || {
              time: getCurrentStandardizedTime(),
              rmsTotal: 0,
              semiMajor: 0,
              semiMinor: 0,
              orientation: 0,
              latitudeError: 0,
              longitudeError: 0,
              heightError: 0
            }
          },
          featureTypeName: selectedFeatureType.name
        },
        created_by: String(user?.id || 'unknown'),
        created_at: getCurrentStandardizedTime(),
        updated_at: getCurrentStandardizedTime(),
        updated_by: String(user?.id || 'unknown'),
        synced: false,
        feature_id: 0,
        project_id: activeProject?.id || 0
      });

      console.log('Point collected successfully:', clientId);
    } catch (error) {
      console.error('Error collecting point:', error);
    }
  }, [currentLocation, selectedFeatureType, renderFeature, ggaData, gstData, activeProject, user]);

  return {
    handlePointCollection
  };
}; 