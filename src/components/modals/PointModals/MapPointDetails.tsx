import React, { useState, useCallback, useContext } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { Colors } from '@/src/theme/colors';
import { PointCollected } from '@/types/pointCollected.types';
import { formatDate } from '@/src/utils/date';
import { storageService } from '@/services/storage/storageService';
import { AuthContext } from '@/src/contexts/AuthContext';
import { AuthContextState } from '@/types/auth.types';
import { featureService } from '@/services/features/featuresService';
import { ProjectContext } from '@/src/contexts/ProjectContext';
import { useMapContext } from '@/src/contexts/MapDisplayContext';
import { Feature, FeatureToRender } from '@/types/features.types';

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
  const [description, setDescription] = useState(point.properties?.description || '');
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
        properties: {
          ...point.properties,
          description
        }
      };
      
      // Save back to storage using updatePoint
      await storageService.updatePoint(updatedPoint);
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
              
              // Try to inactivate the feature - this might succeed or fail if already inactive
              try {
                await featureService.inactivateFeature(activeProject.id, point.id.toString());
              } catch (error) {
                console.log('Error inactivating feature:', error);
                // Continue with refresh even if inactivation failed - the feature might already be inactive
              }
              
              // Always refresh the features to ensure map is in sync with backend
              try {
                // Clear existing features first
                clearFeatures();
                // Fetch and update with active features
                const activeFeatures = await featureService.fetchActiveFeatures(activeProject.id);
                // Render each active feature on the map
                activeFeatures.forEach((feature: Feature) => {
                  // Skip features without valid coordinates
                  if (!feature.coordinates || 
                      (Array.isArray(feature.coordinates) && feature.coordinates.length < 2)) {
                    console.warn('Skipping feature with invalid coordinates:', feature.id);
                    return;
                  }

                  try {
                    // Ensure coordinates are in the correct format
                    let formattedCoordinates: [number, number] | [number, number][];
                    
                    if (feature.type === 'Point') {
                      // For points, ensure we have a single coordinate pair
                      if (!Array.isArray(feature.coordinates)) {
                        console.warn('Invalid coordinates format for point:', feature.id);
                        return;
                      }

                      if (Array.isArray(feature.coordinates[0])) {
                        // Handle nested array format: [[lon, lat]]
                        const coord = feature.coordinates[0];
                        if (!Array.isArray(coord) || coord.length < 2) {
                          console.warn('Invalid nested coordinates for point:', feature.id);
                          return;
                        }
                        formattedCoordinates = [Number(coord[0]), Number(coord[1])] as [number, number];
                      } else {
                        // Handle flat array format: [lon, lat]
                        if (feature.coordinates.length < 2) {
                          console.warn('Invalid flat coordinates for point:', feature.id);
                          return;
                        }
                        formattedCoordinates = [
                          Number(feature.coordinates[0]),
                          Number(feature.coordinates[1])
                        ] as [number, number];
                      }
                    } else {
                      // For lines/polygons, ensure we have an array of coordinate pairs
                      if (!Array.isArray(feature.coordinates)) {
                        console.warn('Invalid coordinates format for line/polygon:', feature.id);
                        return;
                      }

                      if (Array.isArray(feature.coordinates[0])) {
                        // Already in correct format: [[lon, lat], [lon, lat], ...]
                        formattedCoordinates = feature.coordinates.map(coord => {
                          if (!Array.isArray(coord) || coord.length < 2) {
                            throw new Error('Invalid coordinate pair in line/polygon');
                          }
                          return [Number(coord[0]), Number(coord[1])] as [number, number];
                        });
                      } else {
                        // Convert single pair to array: [lon, lat] -> [[lon, lat]]
                        if (feature.coordinates.length < 2) {
                          console.warn('Invalid coordinates for line/polygon:', feature.id);
                          return;
                        }
                        formattedCoordinates = [[
                          Number(feature.coordinates[0]),
                          Number(feature.coordinates[1])
                        ] as [number, number]];
                      }
                    }

                    const featureToRender: FeatureToRender = {
                      type: feature.type,
                      coordinates: formattedCoordinates,
                      properties: {
                        featureId: feature.id,
                        name: feature.name,
                        draw_layer: feature.draw_layer,
                        ...feature.properties
                      }
                    };
                    renderFeature(featureToRender);
                  } catch (error) {
                    console.error('Error formatting coordinates for feature:', feature.id, error);
                  }
                });
                
                onClose();
              } catch (error) {
                console.error('Error refreshing features:', error);
                Alert.alert('Warning', 'The map may need to be refreshed manually.');
              }
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
                  <Text style={styles.value}>{point.featureType}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Collected By:</Text>
                  <Text style={styles.value}>{user?.name || 'Unknown'}</Text>
                </View>
                
                {/* Description Field */}
                <View style={styles.detailRow}>
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
                              setDescription(point.properties?.description || '');
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
                  <Text style={styles.value}>{formatValue(point.nmeaData.gga.altitude)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Geoid Height:</Text>
                  <Text style={styles.value}>{formatValue(point.nmeaData.gga.geoidHeight)} m</Text>
                </View>

                {/* Quality Indicators */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Fix Quality:</Text>
                  <Text style={styles.value}>{getFixQualityText(point.nmeaData.gga.quality)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Satellites:</Text>
                  <Text style={styles.value}>{point.nmeaData.gga.satellites}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>HDOP:</Text>
                  <Text style={styles.value}>{formatValue(point.nmeaData.gga.hdop)}</Text>
                </View>

                {/* Error Estimates */}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>RMS Total:</Text>
                  <Text style={styles.value}>{formatValue(point.nmeaData.gst.rmsTotal)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Lat Error:</Text>
                  <Text style={styles.value}>{formatValue(point.nmeaData.gst.latitudeError)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Lon Error:</Text>
                  <Text style={styles.value}>{formatValue(point.nmeaData.gst.longitudeError)} m</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Height Error:</Text>
                  <Text style={styles.value}>{formatValue(point.nmeaData.gst.heightError)} m</Text>
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
});

export default MapPointDetails;