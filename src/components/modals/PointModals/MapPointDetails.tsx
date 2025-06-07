import React, { useState, useCallback, useContext, useEffect, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { Colors } from '@/theme/colors';
import { PointCollected } from '@/types/pointCollected.types';
import { formatDate } from '@/utils/date';
import { displayInLocalTimezone } from '@/utils/datetime';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { AuthContext } from '@/contexts/AuthContext';
import { AuthContextState } from '@/types/auth.types';
import { featureTypeService } from '@/services/features/featureTypeService';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { FeatureToRender } from '@/types/featuresToRender.types';
import { collectedFeatureService } from '@/services/features/collectedFeatureService';
import { Feature } from 'geojson';
import { CollectedFeature } from '@/types/currentFeatures.types';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { FormQuestion, FeatureType } from '@/types/featureType.types';
import RTKProDataDisplay from './RTKProDataDisplay';
import { calculateLineDistance, formatDistance } from '@/utils/collections';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { LineFeatureListModal } from '../FeatureModals/LineFeatureListModal';

const MAX_DESCRIPTION_LENGTH = 500;

interface MapPointDetailsProps {
  isVisible: boolean;
  onClose: () => void;
  point: PointCollected | null;
  onCollectFromPoint?: (point: PointCollected, selectedFeatureType: FeatureType) => void;
}

const MapPointDetails: React.FC<MapPointDetailsProps> = ({
  isVisible,
  onClose,
  point,
  onCollectFromPoint
}) => {
  // Early return BEFORE any hooks are called
  if (!point) return null;
  
  // Initialize refs for component lifecycle management
  const mountedRef = React.useRef(true);
  const initializedRef = React.useRef(false);
  
  const { user } = useContext(AuthContext) as AuthContextState;
  const { activeProject } = useContext(ProjectContext);
  const { clearFeatures, renderFeature } = useMapContext();
  const { getFeatureTypeByName } = useFeatureTypeContext();
  const { startCollection } = useCollectionContext();
  
  // Initialize state with safe defaults
  const [description, setDescription] = useState(() => point?.description || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLineFeatureModalVisible, setIsLineFeatureModalVisible] = useState(false);
  const [lineDistance, setLineDistance] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initialize component when point changes
  useEffect(() => {
    if (!point || !mountedRef.current) return;
    
    // Reset states when point changes
    setDescription(point.description || '');
    setIsEditing(false);
    setIsSaving(false);
    setIsDeleting(false);
    setIsLineFeatureModalVisible(false);
    setLineDistance(0);
    
    // Mark as initialized after a brief delay to ensure stability
    const initTimer = setTimeout(() => {
      if (mountedRef.current) {
        setIsInitialized(true);
        initializedRef.current = true;
      }
    }, 50);
    
    return () => {
      clearTimeout(initTimer);
      setIsInitialized(false);
      initializedRef.current = false;
    };
  }, [point?.client_id]);

  // Memoize derived values to prevent unnecessary recalculations
  const pointInfo = useMemo(() => {
    if (!point) return { isLinePoint: false, parentLineId: undefined, pointIndex: undefined };
    
    return {
      isLinePoint: point.attributes?.isLinePoint === true,
      parentLineId: point.attributes?.parentLineId,
      pointIndex: point.attributes?.pointIndex
    };
  }, [point?.attributes?.isLinePoint, point?.attributes?.parentLineId, point?.attributes?.pointIndex]);

  // Helper function to get nmeaData regardless of point structure
  const nmeaData = useMemo(() => {
    if (!point) return null;
    
    // Check if nmeaData is directly on the point
    if (point.attributes?.nmeaData) {
      return point.attributes.nmeaData;
    }
    // Check if nmeaData is in points[0].attributes
    if (point.points?.[0]?.attributes?.nmeaData) {
      return point.points[0].attributes.nmeaData;
    }
    return null;
  }, [point?.attributes?.nmeaData, point?.points]);

  // Helper function to get the total line distance
  const getLineDistance = useCallback(async (): Promise<number> => {
    if (!pointInfo.isLinePoint || !pointInfo.parentLineId || !activeProject || !mountedRef.current) {
      return 0;
    }
    
    try {
      // Get all features for the project
      const features = await featureStorageService.getFeaturesForProject(activeProject.id);
      
      // Find the parent line feature
      const lineFeature = features.find(f => f.client_id === pointInfo.parentLineId);
      if (!lineFeature || !lineFeature.points || lineFeature.points.length < 2) {
        return 0;
      }
      
      // Check if total distance is already stored in the line feature attributes
      if (lineFeature.attributes?.totalDistance && typeof lineFeature.attributes.totalDistance === 'number') {
        console.log(`📏 Using stored line distance: ${lineFeature.attributes.totalDistance} meters`);
        return lineFeature.attributes.totalDistance;
      }
      
      // Calculate distance if not stored
      console.log('📏 Calculating line distance from coordinates...');
      
      // Extract coordinates from the line points
      const coordinates: [number, number][] = [];
      
      // Sort points by their index to ensure correct order
      const sortedPoints = [...lineFeature.points].sort((a, b) => 
        (a.attributes?.pointIndex || 0) - (b.attributes?.pointIndex || 0)
      );
      
      for (const point of sortedPoints) {
        const longitude = point.attributes?.nmeaData?.gga?.longitude;
        const latitude = point.attributes?.nmeaData?.gga?.latitude;
        if (typeof longitude === 'number' && typeof latitude === 'number') {
          coordinates.push([longitude, latitude]);
        }
      }
      
      return calculateLineDistance(coordinates);
    } catch (error) {
      console.error('Error calculating line distance:', error);
      return 0;
    }
  }, [pointInfo.isLinePoint, pointInfo.parentLineId, activeProject]);
  
  // Load line distance when component mounts or when the line data changes
  useEffect(() => {
    if (pointInfo.isLinePoint && isInitialized && mountedRef.current) {
      getLineDistance().then(distance => {
        if (mountedRef.current) {
          setLineDistance(distance);
        }
      });
    }
  }, [pointInfo.isLinePoint, getLineDistance, isInitialized]);

  // Format for display
  const formatValue = useCallback((value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') {
      // For coordinates, show full precision
      if (value > -180 && value < 180) {
        return value.toString();
      }
      // For all other numeric values, show 3 decimal places
      return value.toFixed(3);
    }
    return JSON.stringify(value);
  }, []);

  const getFixQualityText = useCallback((quality: number): string => {
    switch (quality) {
      case 0: return 'Invalid';
      case 1: return 'GPS Fix';
      case 2: return 'DGPS Fix';
      case 3: return 'PPS Fix';
      case 4: return 'RTK Fixed';
      case 5: return 'RTK Float';
      case 6: return 'Estimated';
      case 7: return 'Manual';
      case 8: return 'Simulation';
      default: return 'Unknown';
    }
  }, []);

  const handleSaveDescription = useCallback(async () => {
    if (!point || isSaving || !mountedRef.current) return;

    try {
      setIsSaving(true);
      // Update the point with new description
      const updatedFeature: CollectedFeature = {
        name: point.name,
        draw_layer: point.draw_layer,
        client_id: point.client_id,
        project_id: point.project_id,
        type: pointInfo.isLinePoint ? 'Line' : 'Point',
        points: [{
          ...point,
          description,
          updated_at: new Date().toISOString(),
          updated_by: String(user?.id || point.updated_by)
        }],
        attributes: point.attributes || {},
        is_active: true,
        created_by: Number(point.created_by),
        created_at: point.created_at,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString()
      };
      
      // Save back to storage using updateFeature
      await featureStorageService.updateFeature(updatedFeature);
      
      if (mountedRef.current) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error saving description:', error);
      if (mountedRef.current) {
        Alert.alert('Error', 'Failed to save description. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [point, description, isSaving, user?.id, pointInfo.isLinePoint]);

  const handleCollectFrom = useCallback(async () => {
    if (!point || !onCollectFromPoint || !activeProject || !mountedRef.current) return;
    
    // Check if this is a line point
    if (pointInfo.isLinePoint && pointInfo.parentLineId) {
      try {
        // Get all features to find the parent line
        const features = await featureStorageService.getFeaturesForProject(activeProject.id);
        const parentLine = features.find(f => f.client_id === pointInfo.parentLineId);
        
        if (parentLine) {
          // Get the feature type from the parent line's attributes
          const featureTypeName = parentLine.attributes?.featureTypeName || parentLine.name?.split(/\s+\d+$/)[0];
          
          if (featureTypeName) {
            // Get the full feature type object
            const featureType = getFeatureTypeByName(featureTypeName);
            
            if (featureType) {
              console.log(`Auto-detected line type: ${featureType.name} for line point`);
              
              // Get the point coordinates
              const longitude = point.attributes?.nmeaData?.gga?.longitude || point.attributes?.longitude;
              const latitude = point.attributes?.nmeaData?.gga?.latitude || point.attributes?.latitude;
              
              if (typeof longitude !== 'number' || typeof latitude !== 'number') {
                Alert.alert('Error', 'Could not get valid coordinates from this point.');
                return;
              }

              // Close modal and start collection directly
              onClose();
              onCollectFromPoint(point, featureType);
              return;
            }
          }
        }
        
        console.warn('Could not determine line type for line point, falling back to selection modal');
      } catch (error) {
        console.error('Error auto-detecting line type:', error);
      }
    }
    
    // For standalone points or if auto-detection failed, show the feature selection modal
    if (mountedRef.current) {
      setIsLineFeatureModalVisible(true);
    }
  }, [point, onCollectFromPoint, activeProject, pointInfo.isLinePoint, pointInfo.parentLineId, getFeatureTypeByName, onClose]);

  const handleLineFeatureSelect = useCallback((selectedFeatureType: FeatureType) => {
    if (!point || !onCollectFromPoint || !mountedRef.current) return;
    
    try {
      // Get the point coordinates
      const longitude = point.attributes?.nmeaData?.gga?.longitude || point.attributes?.longitude;
      const latitude = point.attributes?.nmeaData?.gga?.latitude || point.attributes?.latitude;
      
      if (typeof longitude !== 'number' || typeof latitude !== 'number') {
        Alert.alert('Error', 'Could not get valid coordinates from this point.');
        return;
      }

      // Close both modals
      setIsLineFeatureModalVisible(false);
      onClose();
      
      // Start collection from this point
      onCollectFromPoint(point, selectedFeatureType);
    } catch (error) {
      console.error('Error starting collection from point:', error);
      Alert.alert('Error', 'Failed to start collection from this point.');
    }
  }, [point, onCollectFromPoint, onClose]);

  const handleLineFeatureModalClose = useCallback(() => {
    if (mountedRef.current) {
      setIsLineFeatureModalVisible(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!point || !activeProject || isDeleting || !mountedRef.current) return;

    Alert.alert(
      'Delete Point',
      'Are you sure you want to delete this point? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!mountedRef.current) return;
            
            try {
              setIsDeleting(true);
              
              // Try to inactivate the feature
              try {
                await collectedFeatureService.inactivateFeature(activeProject.id, point.feature_id.toString());
              } catch (error) {
                console.log('Error inactivating feature:', error);
              }
              
              // Clear existing features and refresh
              clearFeatures();
              const activeFeatures = await collectedFeatureService.fetchActiveFeatures(activeProject.id);
              
              // Render each active feature on the map
              activeFeatures.forEach((feature: any) => {
                if (!feature.nmeaData?.gga) {
                  console.warn('Skipping feature with invalid NMEA data:', feature.client_id);
                  return;
                }

                const lon = feature.nmeaData.gga.longitude;
                const lat = feature.nmeaData.gga.latitude;
                
                if (lon !== undefined && lat !== undefined) {
                  const featureToRender: FeatureToRender = {
                    type: 'Point',
                    coordinates: [lon, lat],
                    properties: {
                      featureId: feature.feature_id,
                      name: feature.name,
                      description: feature.description,
                      draw_layer: feature.draw_layer,
                      ...feature.attributes
                    }
                  };
                  renderFeature(featureToRender);
                }
              });
              
              onClose();
            } catch (error) {
              console.error('Error refreshing features:', error);
              if (mountedRef.current) {
                Alert.alert('Warning', 'The map may need to be refreshed manually.');
              }
            } finally {
              if (mountedRef.current) {
                setIsDeleting(false);
              }
            }
          }
        }
      ]
    );
  }, [point, activeProject, isDeleting, onClose, clearFeatures, renderFeature]);

  // Memoize form data entries to prevent unnecessary re-renders
  const formDataEntries = useMemo(() => {
    if (!point?.attributes?.formData || Object.keys(point.attributes.formData).length === 0 || !isInitialized) {
      return [];
    }
    
    return Object.entries(point.attributes.formData).map(([questionId, answer]) => {
      // Try to find the original question text if available
      const featureType = getFeatureTypeByName(point.name);
      const question = featureType?.form_definition?.questions.find((q: FormQuestion) => q.id === questionId);
      const questionText = question?.question || questionId;
      
      return {
        questionId,
        questionText,
        answer: typeof answer === 'boolean' 
          ? (answer ? 'Yes' : 'No') 
          : String(answer || 'Not answered')
      };
    });
  }, [point?.attributes?.formData, point?.name, getFeatureTypeByName, isInitialized]);

  // Don't render until properly initialized to prevent React errors
  if (!isInitialized) {
    return null;
  }

  return (
    <Modal
      key={`point-details-${point.client_id}`}
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Point Details</Text>
            <View style={styles.headerButtons}>
              {onCollectFromPoint && (
                <TouchableOpacity 
                  onPress={handleCollectFrom}
                  style={[styles.headerButton, styles.collectFromButton]}
                >
                  <Text style={styles.collectFromButtonText}>
                    {pointInfo.isLinePoint ? 'Continue Line' : 'Collect From'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={handleDelete}
                style={[styles.headerButton, styles.deleteButton]}
                disabled={isDeleting}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={onClose} 
                style={styles.headerButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollView}>
            <View style={styles.detailsContainer}>
              {/* Basic Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basic Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Name:</Text>
                  <Text style={styles.value}>{point.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Type:</Text>
                  <Text style={styles.value}>{pointInfo.isLinePoint ? 'Line Point' : 'Point'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Collected By:</Text>
                  <Text style={styles.value}>{user?.name || 'Unknown'}</Text>
                </View>
                
                {/* Description Field */}
                <View style={styles.descriptionRow}>
                  <Text style={styles.label}>Description:</Text>
                  <View style={styles.descriptionContainer}>
                    {isEditing ? (
                      <View style={styles.editingContainer}>
                        <TextInput
                          style={styles.descriptionInput}
                          value={description}
                          onChangeText={setDescription}
                          maxLength={MAX_DESCRIPTION_LENGTH}
                          placeholder="Enter description..."
                          placeholderTextColor={Colors.Grey}
                        />
                        <View style={styles.descriptionButtons}>
                          <TouchableOpacity 
                            style={[styles.descriptionButton, styles.cancelButton]}
                            onPress={() => {
                              setDescription(point.description || '');
                              setIsEditing(false);
                            }}
                          >
                            <Text style={styles.buttonText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.descriptionButton, styles.saveButton]}
                            onPress={handleSaveDescription}
                            disabled={isSaving}
                          >
                            <Text style={styles.buttonText}>
                              {isSaving ? 'Saving...' : 'Save'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.characterCount}>
                          {description.length}/{MAX_DESCRIPTION_LENGTH}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.viewContainer}>
                        <Text style={styles.value}>
                          {description || 'No description'}
                        </Text>
                        <TouchableOpacity 
                          style={styles.editButton}
                          onPress={() => setIsEditing(true)}
                        >
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.label}>Timestamp:</Text>
                  <Text style={styles.value}>
                    {displayInLocalTimezone(point.created_at, point.attributes?.timezone || undefined)}
                    {point.attributes?.timezone ? ` (${point.attributes.timezone})` : ''}
                  </Text>
                </View>
              </View>

              {/* GNSS Data */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>GNSS Data</Text>
                {/* Position */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Longitude:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gga?.longitude)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Latitude:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gga?.latitude)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Altitude:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gga?.altitude)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Geoid Height:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gga?.geoidHeight)} m</Text>
                </View>

                {/* Quality Indicators */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Fix Quality:</Text>
                  <Text style={styles.value}>{getFixQualityText(nmeaData?.gga?.quality ?? 0)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Satellites:</Text>
                  <Text style={styles.value}>{nmeaData?.gga?.satellites}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>HDOP:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gga?.hdop)}</Text>
                </View>

                {/* Error Estimates */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>RMS Total:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gst?.rmsTotal)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Lat Error:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gst?.latitudeError)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Lon Error:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gst?.longitudeError)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Height Error:</Text>
                  <Text style={styles.value}>{formatValue(nmeaData?.gst?.heightError)} m</Text>
                </View>
              </View>

              {/* Line Point Information */}
              {pointInfo.isLinePoint && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Line Information</Text>
                  </View>
                  <View style={styles.sectionContent}>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Parent Line:</Text>
                      <Text style={styles.value}>{pointInfo.parentLineId || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Total Line Distance:</Text>
                      <Text style={styles.value}>{formatDistance(lineDistance)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Point Index:</Text>
                      <Text style={styles.value}>{pointInfo.pointIndex !== undefined ? (pointInfo.pointIndex + 1) : 'N/A'}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Form Data */}
              {formDataEntries.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Form Data</Text>
                  {formDataEntries.map(({ questionId, questionText, answer }) => (
                    <View key={questionId} style={styles.detailRow}>
                      <Text style={styles.label}>{questionText}:</Text>
                      <Text style={styles.value}>{answer}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* RTK-Pro Data */}
              <RTKProDataDisplay
                locateData={point.attributes?.rtkProData?.locateData || point.points?.[0]?.attributes?.rtkProData?.locateData}
                gpsData={point.attributes?.rtkProData?.gpsData || point.points?.[0]?.attributes?.rtkProData?.gpsData}
                isLinePoint={pointInfo.isLinePoint}
              />
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Line Feature Selection Modal */}
      <LineFeatureListModal
        isVisible={isLineFeatureModalVisible}
        onClose={handleLineFeatureModalClose}
        onFeatureSelect={handleLineFeatureSelect}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.Grey,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    padding: 8,
    borderRadius: 5,
  },
  collectFromButton: {
    backgroundColor: Colors.Aqua,
  },
  collectFromButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: Colors.BrightRed,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButtonText: {
    color: Colors.DarkBlue,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    maxHeight: '80%',
  },
  detailsContainer: {
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  label: {
    fontSize: 14,
    color: Colors.Grey,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: Colors.DarkBlue,
    flex: 2,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  descriptionContainer: {
    flex: 2,
  },
  editingContainer: {
    flexDirection: 'column',
    gap: 5,
  },
  viewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: Colors.Grey,
    borderRadius: 5,
    padding: 8,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  descriptionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 5,
  },
  descriptionButton: {
    padding: 8,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.Grey,
  },
  saveButton: {
    backgroundColor: Colors.DarkBlue,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  characterCount: {
    fontSize: 12,
    color: Colors.Grey,
    textAlign: 'right',
  },
  editButton: {
    padding: 5,
    borderRadius: 5,
    backgroundColor: Colors.DarkBlue,
  },
  editButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHeader: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.Grey,
  },
  sectionContent: {
    padding: 10,
  },
});

export default MapPointDetails;