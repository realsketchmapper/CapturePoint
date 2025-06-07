import { useCallback, useState } from 'react';
import { useLocationContext } from '@/contexts/LocationContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { useRTKPro } from '@/contexts/RTKProContext';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { generateId } from '@/utils/collections';
import { getCurrentStandardizedTime } from '@/utils/datetime';
import React from 'react';

/**
 * Hook for collecting point features
 * @returns Object with point collection functions
 */
export const usePointCollection = () => {
  const { currentLocation } = useLocationContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { renderFeature, addPoint } = useMapContext();
  const { ggaData, gstData } = useNMEAContext();
  const { currentLocateData, currentGPSData, lastButtonPressTime } = useRTKPro();
  const { activeProject } = useProjectContext();
  const { user } = useAuthContext();
  const { isCollecting, activeFeatureType, startCollection, recordPoint } = useCollectionContext();
  
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

    // Check for form definition

    // Check if the feature type has a form definition
    if (selectedFeatureType.form_definition && 
        selectedFeatureType.form_definition.questions && 
        selectedFeatureType.form_definition.questions.length > 0) {
      // Show form modal
      setIsFormModalVisible(true);
      return;
    }
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
      // Debug RTK-Pro data availability
      console.log('🔍 RTK-Pro data during collection:');
      console.log('  - currentLocateData:', currentLocateData);
      console.log('  - currentGPSData:', currentGPSData);
      console.log('  - lastButtonPressTime:', lastButtonPressTime);

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

      // Create attributes object with NMEA data and form responses
      const attributes: any = {
        nmeaData: {
          gga: ggaData,
          gst: gstData
        },
        formData: formResponses || {},
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      // Add RTK-Pro data if available
      if (currentLocateData || currentGPSData) {
        attributes.rtkProData = {
          locateData: currentLocateData,
          gpsData: currentGPSData,
          timestamp: lastButtonPressTime || new Date().toISOString()
        };
        console.log('🎯 RTK-Pro data added to POINT ATTRIBUTES (not feature properties):', attributes.rtkProData);
        console.log('📍 Storage location: point.attributes.rtkProData');
      } else {
        console.log('⚠️ No RTK-Pro data available during point collection');
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
  }, [currentLocation, selectedFeatureType, renderFeature, ggaData, gstData, currentLocateData, currentGPSData, lastButtonPressTime, activeProject, user]);

  /**
   * Handle form submission
   */
  const handleFormSubmit = useCallback((formResponses: { [key: string]: any }) => {
    collectPoint(formResponses);
  }, [collectPoint]);

  /**
   * Cancel form collection
   */
  const handleFormCancel = useCallback(() => {
    setIsFormModalVisible(false);
  }, []);

  // Register auto-collection handler globally for RTK-Pro button press integration
  React.useEffect(() => {
    // Add debounce to prevent rapid button presses
    let isProcessing = false;
    
    (global as any).autoCollectPoint = async () => {
      // Prevent rapid successive calls
      if (isProcessing) {
        console.log('🚦 Auto-collection already in progress, ignoring rapid button press');
        return;
      }
      
      isProcessing = true;
      
      console.log('🎯 Auto-collection triggered from RTK-Pro button press');
      
      // Use activeFeatureType if collecting (line mode), otherwise use selectedFeatureType
      const featureTypeToUse = isCollecting ? activeFeatureType : selectedFeatureType;
      
      if (!featureTypeToUse) {
        console.warn('⚠️ No feature type selected - cannot auto-collect point');
        console.log('📝 Please select a feature type in the app before pressing the RTK-Pro collect button');
        console.log(`📊 Collection state: isCollecting=${isCollecting}, activeFeatureType=${activeFeatureType?.name}, selectedFeatureType=${selectedFeatureType?.name}`);
        isProcessing = false;
        return;
      }
      
      if (!currentLocation) {
        console.warn('⚠️ No current location - cannot auto-collect point');
        console.log('📍 Please ensure GPS/NMEA positioning is active before collecting points');
        isProcessing = false;
        return;
      }
      
      console.log(`🚀 Auto-collecting ${featureTypeToUse.name} (${featureTypeToUse.type}) from RTK-Pro button press`);
      console.log(`📍 Location: [${Array.isArray(currentLocation) ? currentLocation.join(', ') : `${currentLocation.longitude}, ${currentLocation.latitude}`}]`);
      console.log(`📊 Using ${isCollecting ? 'activeFeatureType' : 'selectedFeatureType'} for collection`);
      
      try {
        // Handle different feature types
        switch (featureTypeToUse.type) {
          case 'Point':
            // For Point features, check if it has a form definition
            console.log('📍 Collecting Point feature');
            
            // Check if the feature type has a form definition that requires user input
            if (featureTypeToUse.form_definition && 
                featureTypeToUse.form_definition.questions && 
                featureTypeToUse.form_definition.questions.length > 0) {
              console.log('📋 Feature has form definition - showing form modal for RTK-Pro collection');
              console.log(`📋 Form has ${featureTypeToUse.form_definition.questions.length} questions`);
              
              // Show the form modal for RTK-Pro triggered collection
              setIsFormModalVisible(true);
              console.log('✅ Form modal triggered for RTK-Pro auto-collection');
            } else {
              // No form definition, collect point directly
              console.log('📍 No form definition - collecting point directly');
              
              // Get fresh RTK-Pro data directly from context
              console.log('🔍 Getting fresh RTK-Pro data for auto-collection:');
              console.log('  - currentLocateData:', currentLocateData);
              console.log('  - currentGPSData:', currentGPSData);
              console.log('  - lastButtonPressTime:', lastButtonPressTime);
              
              // Call collectPoint with fresh data context
              await collectPoint();
              console.log('✅ Point collection completed successfully!');
            }
            break;
            
          case 'Line':
            // For Line features, either start line collection or add point to existing line
            if (isCollecting) {
              // Already collecting a line - add a new point
              console.log('📏 Adding point to existing line collection');
              const success = recordPoint(currentLocation);
              if (success) {
                console.log('✅ Point added to line successfully!');
              } else {
                console.error('❌ Failed to add point to line');
              }
            } else {
              // Start a new line collection
              console.log('📏 Starting new line collection');
              try {
                startCollection(currentLocation, featureTypeToUse);
                console.log('✅ Line collection started successfully!');
                console.log('📝 Press the RTK-Pro button again to add more points, or use the app to finish the line');
              } catch (error) {
                console.error('❌ Failed to start line collection:', error);
              }
            }
            break;
            
          default:
            console.warn(`⚠️ Unsupported feature type: ${featureTypeToUse.type}`);
            console.log('📝 Falling back to point collection');
            await collectPoint();
            break;
        }
        
        console.log('🎯 RTK-Pro data automatically included in collection');
      } catch (error) {
        console.error('❌ RTK-Pro auto-collection failed:', error);
      } finally {
        // Reset the flag after a small delay to prevent rapid-fire
        setTimeout(() => {
          isProcessing = false;
        }, 500); // 500ms debounce
      }
    };
    
    return () => {
      (global as any).autoCollectPoint = null;
    };
  }, [selectedFeatureType, activeFeatureType, isCollecting, currentLocation, collectPoint, startCollection, recordPoint, currentLocateData, currentGPSData, lastButtonPressTime, setIsFormModalVisible]);

  return {
    handlePointCollection,
    collectPoint,
    isFormModalVisible,
    setIsFormModalVisible,
    handleFormSubmit,
    handleFormCancel
  };
}; 