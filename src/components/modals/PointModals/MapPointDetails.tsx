import React, { useState, useCallback, useContext } from 'react';
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
import { FormQuestion } from '@/types/featureType.types';
import RTKProDataDisplay from './RTKProDataDisplay';

const MAX_DESCRIPTION_LENGTH = 500;

interface MapPointDetailsProps {
  isVisible: boolean;
  onClose: () => void;
  point: PointCollected | null;
}

const MapPointDetails: React.FC<MapPointDetailsProps> = ({
  isVisible,
  onClose,
  point
}) => {
  if (!point) return null;

  const { user } = useContext(AuthContext) as AuthContextState;
  const { activeProject } = useContext(ProjectContext);
  const { clearFeatures, renderFeature } = useMapContext();
  const { getFeatureTypeByName } = useFeatureTypeContext();
  const [description, setDescription] = useState(point.description || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine if this is a line point
  const isLinePoint = point.attributes?.isLinePoint === true;
  const parentLineId = point.attributes?.parentLineId;
  const pointIndex = point.attributes?.pointIndex;

  // Helper function to get nmeaData regardless of point structure
  const getNmeaData = (point: PointCollected) => {
    // Check if nmeaData is directly on the point
    if (point.attributes?.nmeaData) {
      return point.attributes.nmeaData;
    }
    // Check if nmeaData is in points[0].attributes
    if (point.points?.[0]?.attributes?.nmeaData) {
      return point.points[0].attributes.nmeaData;
    }
    return null;
  };

  // Get point data for display
  const nmeaData = getNmeaData(point);

  // Debug RTK-Pro data to see what's actually stored
  console.log('🔍 Point attributes:', point.attributes);
  console.log('🔍 RTK-Pro data in point:', point.attributes?.rtkProData);
  console.log('🔍 Has locate data:', !!point.attributes?.rtkProData?.locateData);
  console.log('🔍 Has GPS data:', !!point.attributes?.rtkProData?.gpsData);

  // Format for display
  const formatValue = (value: any): string => {
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
  };

  const getFixQualityText = (quality: number): string => {
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
  };

  const handleSaveDescription = useCallback(async () => {
    if (!point || isSaving) return;

    try {
      setIsSaving(true);
      // Update the point with new description
      const updatedFeature: CollectedFeature = {
        name: point.name,
        draw_layer: point.draw_layer,
        client_id: point.client_id,
        project_id: point.project_id,
        type: isLinePoint ? 'Line' : 'Point',
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
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving description:', error);
      Alert.alert('Error', 'Failed to save description. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [point, description, isSaving, user?.id, isLinePoint]);

  const handleDelete = useCallback(async () => {
    if (!point || !activeProject || isDeleting) return;

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
              Alert.alert('Warning', 'The map may need to be refreshed manually.');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }, [point, activeProject, isDeleting, onClose, clearFeatures, renderFeature]);

  return (
    <Modal
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
                  <Text style={styles.value}>{isLinePoint ? 'Line Point' : 'Point'}</Text>
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
              {isLinePoint && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Line Information</Text>
                  </View>
                  <View style={styles.sectionContent}>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Parent Line:</Text>
                      <Text style={styles.value}>{parentLineId || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Point Index:</Text>
                      <Text style={styles.value}>{pointIndex !== undefined ? (pointIndex + 1) : 'N/A'}</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Form Data */}
              {point?.attributes?.formData && Object.keys(point.attributes.formData).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Form Data</Text>
                  {Object.entries(point.attributes.formData).map(([questionId, answer], index) => {
                    // Try to find the original question text if available
                    const featureType = getFeatureTypeByName(point.name);
                    const question = featureType?.form_definition?.questions.find((q: FormQuestion) => q.id === questionId);
                    const questionText = question?.question || questionId;
                    
                    return (
                      <View key={questionId} style={styles.detailRow}>
                        <Text style={styles.label}>{questionText}:</Text>
                        <Text style={styles.value}>
                          {typeof answer === 'boolean' 
                            ? (answer ? 'Yes' : 'No') 
                            : String(answer || 'Not answered')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* RTK-Pro Data Section */}
              {(point.attributes?.rtkProData?.locateData || point.attributes?.rtkProData?.gpsData) ? (
                <RTKProDataDisplay 
                  locateData={point.attributes.rtkProData.locateData}
                  gpsData={point.attributes.rtkProData.gpsData}
                />
              ) : (
                // Debug fallback - remove this after testing
                point.attributes?.rtkProData ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>RTK-Pro Data Debug</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>RTK-Pro data exists but no locate/GPS data found</Text>
                      <Text style={styles.value}>Check data structure</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Raw RTK-Pro data:</Text>
                      <Text style={styles.value}>{JSON.stringify(point.attributes.rtkProData)}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>RTK-Pro Data</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Status:</Text>
                      <Text style={styles.value}>No RTK-Pro data captured for this point</Text>
                    </View>
                  </View>
                )
              )}
            </View>
          </ScrollView>
        </View>
      </View>
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