import { useState, useCallback } from 'react';
import { PointCollected } from '@/types/pointCollected.types';
import { CollectionState } from '@/types/collection.types';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { generateId } from '@/utils/collections';
import { getCurrentStandardizedTime } from '@/utils/datetime';

export const useFeatureStorage = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ggaData, gstData } = useNMEAContext();

  /**
   * Saves a collected point to local storage
   */
  const savePoint = useCallback(async (pointData: Partial<PointCollected>, state: CollectionState): Promise<boolean> => {
    // Validate required data
    if (!state.isActive || 
        !state.points.length || 
        !state.activeFeatureType || 
        !state.metadata.project_id || 
        !ggaData || 
        !gstData) {
      setError('Missing required data for saving point');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const point: PointCollected = {
        client_id: generateId(),
        name: state.activeFeatureType.name,
        description: pointData.description || '',
        draw_layer: state.activeFeatureType.draw_layer,
        attributes: {
          ...pointData.attributes,
          nmeaData: pointData.attributes?.nmeaData || {
            gga: ggaData,
            gst: gstData
          }
        },
        created_by: state.metadata.created_by,
        created_at: state.metadata.created_at,
        updated_at: getCurrentStandardizedTime(),
        updated_by: state.metadata.updated_by,
        synced: false,
        feature_id: 0, // Indicates unsynced state
        project_id: state.metadata.project_id
      };

      await featureStorageService.savePoint(point);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error saving point';
      console.error('Error saving point:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [ggaData, gstData]);

  /**
   * Gets the count of unsynced features for a project
   */
  const getUnsyncedCount = useCallback(async (projectId: number): Promise<number> => {
    try {
      const unsyncedFeatures = await featureStorageService.getUnsyncedFeatures(projectId);
      return unsyncedFeatures.length;
    } catch (error) {
      console.error('Error getting unsynced count:', error);
      return 0;
    }
  }, []);

  return {
    isSaving,
    error,
    savePoint,
    getUnsyncedCount
  };
}; 