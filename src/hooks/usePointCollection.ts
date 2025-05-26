import { useCallback, useState } from 'react';
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
  
  // State for form modal
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [formData, setFormData] = useState<{ [key: string]: any }>({});

  /**
   * Handle point collection
   */
  const handlePointCollection = useCallback(async () => {
    if (!currentLocation || !selectedFeatureType) {
      console.warn('Cannot collect point: Missing location or feature type');
      return;
    }

    // Add debugging logs
    console.log('Selected feature type:', selectedFeatureType.name);
    console.log('Has form definition?', !!selectedFeatureType.form_definition);
    if (selectedFeatureType.form_definition) {
      console.log('Form questions count:', selectedFeatureType.form_definition.questions?.length || 0);
      
      // Log full form definition for debugging
      console.log('Full form definition:', JSON.stringify(selectedFeatureType.form_definition));
      
      // Log each question
      selectedFeatureType.form_definition.questions?.forEach((q, i) => {
        console.log(`Question ${i+1}: ${q.question}, Type: ${q.type}, Required: ${q.required}, ID: ${q.id}`);
      });
    }

    // Check if the feature type has a form definition
    if (selectedFeatureType.form_definition && 
        selectedFeatureType.form_definition.questions && 
        selectedFeatureType.form_definition.questions.length > 0) {
      console.log('Showing form modal for', selectedFeatureType.name);
      // Show form modal
      setIsFormModalVisible(true);
      return;
    }

    console.log('No form definition found, collecting point directly');
    // If no form definition, collect point immediately
    await collectPoint();
  }, [currentLocation, selectedFeatureType, ggaData, gstData, activeProject, user]);

  /**
   * Collect point with optional form data
   */
  const collectPoint = useCallback(async (formResponses?: { [key: string]: any }) => {
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

      // Prepare attributes with NMEA data
      const attributes: any = {
        nmeaData: {
          gga: ggaData as NonNullable<typeof ggaData>,
          gst: gstData as NonNullable<typeof gstData>
        },
        featureTypeName: selectedFeatureType.name
      };

      // Add form data if it exists
      if (formResponses && Object.keys(formResponses).length > 0) {
        attributes.formData = formResponses;
      }

      // Save the point to storage
      await featureStorageService.savePoint({
        client_id: clientId,
        name: selectedFeatureType.name,
        description: '',
        draw_layer: selectedFeatureType.draw_layer,
        attributes,
        created_by: String(user?.id || 'unknown'),
        created_at: getCurrentStandardizedTime(),
        updated_at: getCurrentStandardizedTime(),
        updated_by: String(user?.id || 'unknown'),
        synced: false,
        feature_id: 0,
        project_id: activeProject?.id || 0
      });

      console.log('Point collected successfully:', clientId);
      
      // Clear form data and close modal
      setFormData({});
      setIsFormModalVisible(false);
    } catch (error) {
      console.error('Error collecting point:', error);
    }
  }, [currentLocation, selectedFeatureType, renderFeature, ggaData, gstData, activeProject, user]);

  /**
   * Handle form submission
   */
  const handleFormSubmit = useCallback((formResponses: { [key: string]: any }) => {
    setFormData(formResponses);
    collectPoint(formResponses);
  }, [collectPoint]);

  /**
   * Cancel form collection
   */
  const handleFormCancel = useCallback(() => {
    setIsFormModalVisible(false);
    setFormData({});
  }, []);

  return {
    handlePointCollection,
    collectPoint,
    isFormModalVisible,
    setIsFormModalVisible,
    handleFormSubmit,
    handleFormCancel
  };
}; 