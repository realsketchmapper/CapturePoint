import React, { useState, useCallback, useContext } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { Colors } from '@/theme/colors';
import { PointCollected } from '@/types/pointCollected.types';
import { formatDate } from '@/utils/date';
import { storageService } from '@/services/storage/storageService';
import { AuthContext } from '@/contexts/AuthContext';
import { AuthContextState } from '@/types/auth.types';
import { featureTypeService } from '@/services/features/featureTypeService';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { FeatureType, FeatureToRender, CollectedFeature } from '@/types/features.types';
import { Feature } from 'geojson';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';

interface MapPointDetailsProps {
  isVisible: boolean;
  onClose: () => void;
  point: PointCollected | null;
}

const MAX_DESCRIPTION_LENGTH = 50;

const formatNMEATime = (time: string): string => {
  // NMEA time format is HHMMSS.SS
  let hours = parseInt(time.substring(0, 2));
  const minutes = time.substring(2, 4);
  const seconds = time.substring(4, 6);
  const period = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  if (hours > 12) {
    hours -= 12;
  } else if (hours === 0) {
    hours = 12;
  }
  
  return `${hours}:${minutes}:${seconds} ${period}`;
};

const getFixQualityText = (quality: number): string => {
  switch (quality) {
    case 0: return 'Invalid';
    case 1: return 'GPS';
    case 2: return 'DGPS';
    case 3: return 'PPS';
    case 4: return 'RTK Fixed';
    case 5: return 'RTK Float';
    case 6: return 'Estimated (Dead Reckoning)';
    default: return `Unknown (${quality})`;
  }
};

const MapPointDetails: React.FC<MapPointDetailsProps> = ({
  isVisible,
  onClose,
  point
}) => {
  if (!point) return null;

  const { user } = useContext(AuthContext) as AuthContextState;
  const { activeProject } = useContext(ProjectContext);
  const { clearFeatures, renderFeature } = useMapContext();
  const [description, setDescription] = useState(point.attributes.description || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleSaveDescription = useCallback(async () => {
    if (!point || isSaving) return;

    try {
      setIsSaving(true);
      // Update the point with new description
      const updatedPoint = {
        ...point,
        attributes: {
          ...point.attributes,
          description
        }
      };
      
      // Save back to storage
      await storageService.savePoint(updatedPoint);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving description:', error);
    } finally {
      setIsSaving(false);
    }
  }, [point, description, isSaving]);

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
              
              // Get all features for the project
              const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${activeProject.id}`;
              const featuresJson = await AsyncStorage.getItem(featuresKey);
              if (!featuresJson) {
                throw new Error('No features found in storage');
              }

              const features: CollectedFeature[] = JSON.parse(featuresJson);
              
              // Find and update the feature containing this point
              const updatedFeatures = features.map(feature => {
                if (feature.points) {
                  // Filter out the deleted point
                  feature.points = feature.points.filter(p => p.client_id !== point.client_id);
                  
                  // If no points remain, mark the feature as inactive
                  if (feature.points.length === 0) {
                    feature.is_active = false;
                  }
                }
                return feature;
              });

              // Save the updated features
              await AsyncStorage.setItem(featuresKey, JSON.stringify(updatedFeatures));
              
              // Clear and refresh the map
              clearFeatures();
              const { refreshFeatures } = useMapContext();
              await refreshFeatures();
              
              onClose();
            } catch (error) {
              console.error('Error deleting point:', error);
              Alert.alert('Error', 'Failed to delete point. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }, [point, activeProject, isDeleting, onClose, clearFeatures]);

  // Find the matching point in storage
  const findMatchingPoint = useCallback(async (feature: Feature) => {
    if (!activeProject) return null;

    try {
      console.log('Finding matching point for feature:', feature);
      
      // Get all points for the project
      const projectPoints = await storageService.getProjectPoints(activeProject.id);
      console.log('Project points:', projectPoints.map(p => ({
        client_id: p.client_id,
        coordinates: p.coordinates
      })));

      // Find the point that matches the feature's coordinates and client_id
      const matchingPoint = projectPoints.find(point => {
        const isMatch = point.client_id === feature.properties?.client_id;
        console.log('Checking point:', {
          pointClientId: point.client_id,
          featureClientId: feature.properties?.client_id,
          isMatch
        });
        return isMatch;
      });

      if (matchingPoint) {
        console.log('Found matching point:', matchingPoint);
        return matchingPoint;
      }

      console.log('No matching point found');
      return null;
    } catch (error) {
      console.error('Error finding matching point:', error);
      return null;
    }
  }, [activeProject]);

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
              {/* Basic Info Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basic Information</Text>
                
                {/* Name */}
                <View style={styles.row}>
                  <Text style={styles.label}>Name:</Text>
                  <Text style={styles.value}>{point.attributes.name || 'Unnamed Point'}</Text>
                </View>
                
                {/* Type */}
                <View style={styles.row}>
                  <Text style={styles.label}>Type:</Text>
                  <Text style={styles.value}>{point.attributes.type || 'Point'}</Text>
                </View>
                
                {/* Category */}
                <View style={styles.row}>
                  <Text style={styles.label}>Category:</Text>
                  <Text style={styles.value}>{point.attributes.category || 'Uncategorized'}</Text>
                </View>

                {/* Coordinates */}
                <View style={styles.row}>
                  <Text style={styles.label}>Coordinates:</Text>
                  <Text style={styles.value}>{`${point.coordinates[1]}, ${point.coordinates[0]}`}</Text>
                </View>
              </View>

              {/* Collected By */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Collected By</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Collected By:</Text>
                  <Text style={styles.value}>{user?.name || 'Unknown'}</Text>
                </View>
              </View>

              {/* Description Field */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
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
                            setDescription(point.attributes.description || '');
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

              {/* Timestamp */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Timestamp</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Timestamp:</Text>
                  <Text style={styles.value}>{formatDate(point.created_at)}</Text>
                </View>
              </View>

              {/* GNSS Data */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>GNSS Data</Text>
                {/* Position */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Longitude:</Text>
                  <Text style={styles.value}>{formatValue(point.coordinates[0])}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Latitude:</Text>
                  <Text style={styles.value}>{formatValue(point.coordinates[1])}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Altitude:</Text>
                  <Text style={styles.value}>{formatValue(point.attributes.nmeaData?.gga?.altitude)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Geoid Height:</Text>
                  <Text style={styles.value}>{formatValue(point.attributes.nmeaData?.gga?.geoidHeight)} m</Text>
                </View>

                {/* Quality Indicators */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Fix Quality:</Text>
                  <Text style={styles.value}>{point.attributes.nmeaData?.gga ? getFixQualityText(point.attributes.nmeaData.gga.quality) : 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Satellites:</Text>
                  <Text style={styles.value}>{point.attributes.nmeaData?.gga?.satellites || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>HDOP:</Text>
                  <Text style={styles.value}>{formatValue(point.attributes.nmeaData?.gga?.hdop)}</Text>
                </View>

                {/* Error Estimates */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>RMS Total:</Text>
                  <Text style={styles.value}>{formatValue(point.attributes.nmeaData?.gst?.rmsTotal)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Lat Error:</Text>
                  <Text style={styles.value}>{formatValue(point.attributes.nmeaData?.gst?.latitudeError)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Lon Error:</Text>
                  <Text style={styles.value}>{formatValue(point.attributes.nmeaData?.gst?.longitudeError)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Height Error:</Text>
                  <Text style={styles.value}>{formatValue(point.attributes.nmeaData?.gst?.heightError)} m</Text>
                </View>
              </View>
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
    padding: 5,
    fontSize: 14,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.Grey,
    alignSelf: 'flex-end',
  },
  descriptionButtons: {
    flexDirection: 'row',
    gap: 5,
  },
  descriptionButton: {
    padding: 5,
    borderRadius: 5,
    flex: 1,
  },
  editButton: {
    marginLeft: 10,
  },
  editButtonText: {
    color: Colors.DarkBlue,
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: Colors.Grey,
  },
  saveButton: {
    backgroundColor: Colors.DarkBlue,
  },
  buttonText: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: Colors.BrightRed,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
});

export default MapPointDetails;