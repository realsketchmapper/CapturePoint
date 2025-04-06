import { useCallback } from 'react';
import { useLocationContext } from '@/contexts/LocationContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { storageService } from '@/services/storage/storageService';
import { generateId } from '@/utils/collections';

/**
 * Hook for collecting point features
 * @returns Object with point collection functions
 */
export const usePointCollection = () => {
  const { currentLocation } = useLocationContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { renderFeature } = useMapContext();
  const { ggaData, gstData } = useNMEAContext();
  const { activeProject } = useProjectContext();
  const { user } = useAuthContext();

  /**
   * Handle point collection
   */
  const handlePointCollection = useCallback(async () => {
    if (!currentLocation || !selectedFeatureType) {
      console.warn('Cannot collect point: No location or feature type selected');
      return;
    }

    try {
      // Get coordinates in the correct format
      const coordinates: [number, number] = Array.isArray(currentLocation)
        ? currentLocation
        : [currentLocation.longitude, currentLocation.latitude];

      // Create a unique ID for the point
      const clientId = generateId();

      // Create the feature to render
      const featureToRender = {
        type: 'Point' as const,
        coordinates,
        properties: {
          client_id: clientId,
          name: selectedFeatureType.name,
          featureType: selectedFeatureType,
          style: {
            color: selectedFeatureType.color
          }
        }
      };

      // Render the feature on the map
      renderFeature(featureToRender);

      // Save the point to storage
      await storageService.savePoint({
        client_id: clientId,
        name: selectedFeatureType.name,
        description: '',
        draw_layer: selectedFeatureType.draw_layer,
        nmeaData: {
          gga: ggaData || {
            time: new Date().toISOString(),
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
            time: new Date().toISOString(),
            rmsTotal: 0,
            semiMajor: 0,
            semiMinor: 0,
            orientation: 0,
            latitudeError: 0,
            longitudeError: 0,
            heightError: 0
          }
        },
        attributes: {
          featureTypeName: selectedFeatureType.name
        },
        created_by: String(user?.id || 'unknown'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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