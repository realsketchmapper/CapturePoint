import React, { useState, useEffect, useContext } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Colors } from '@/theme/colors';
import { Project, UserFootageSummary } from '@/types/project.types';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { footageStorageService } from '@/services/storage/footageStorageService';
import { calculateLineDistance } from '@/utils/collections';
import { projectService } from '@/services/project/projectService';
import { AuthContext } from '@/contexts/AuthContext';
import { AuthContextState } from '@/types/auth.types';

interface ProjectDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  project: Project | null;
}

interface DistanceByType {
  [layerName: string]: number;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  isVisible,
  onClose,
  project
}) => {
  const { user } = useContext(AuthContext) as AuthContextState;
  const [currentUserDistances, setCurrentUserDistances] = useState<DistanceByType>({});
  const [allUsersFootage, setAllUsersFootage] = useState<{ [userId: string]: UserFootageSummary }>({});
  const [loadingDistances, setLoadingDistances] = useState(false);


  // Convert meters to feet
  const metersToFeet = (meters: number): number => {
    return meters * 3.28084;
  };

  // Format distance in feet
  const formatDistanceInFeet = (meters: number): string => {
    const feet = metersToFeet(meters);
    return `${feet.toFixed(0)}ft`;
  };

  // Calculate distances by feature type for current user
  const calculateCurrentUserDistances = async () => {
    if (!project || !user) return;

    setLoadingDistances(true);
    try {
      const features = await featureStorageService.getFeaturesForProject(project.id);
      const distances: DistanceByType = {};

      // Process each feature - only count features created by current user
      features.forEach(feature => {
        // Only process line features created by the current user
        if (feature.type === 'Line' && 
            feature.points && 
            feature.points.length >= 2 &&
            feature.created_by === user.id) {
          
          const layerName = feature.draw_layer;
          
          // Check if distance is already calculated and stored
          let lineDistance = 0;
          if (feature.attributes?.totalDistance && typeof feature.attributes.totalDistance === 'number') {
            lineDistance = feature.attributes.totalDistance;
          } else {
            // Calculate distance from coordinates
            const coordinates: [number, number][] = [];
            
            // Sort points by their index to ensure correct order
            const sortedPoints = [...feature.points].sort((a, b) => 
              (a.attributes?.pointIndex || 0) - (b.attributes?.pointIndex || 0)
            );
            
            for (const point of sortedPoints) {
              const longitude = point.attributes?.nmeaData?.gga?.longitude;
              const latitude = point.attributes?.nmeaData?.gga?.latitude;
              if (typeof longitude === 'number' && typeof latitude === 'number') {
                coordinates.push([longitude, latitude]);
              }
            }
            
            if (coordinates.length >= 2) {
              lineDistance = calculateLineDistance(coordinates);
            }
          }
          
          // Add to the total for this layer
          if (lineDistance > 0) {
            distances[layerName] = (distances[layerName] || 0) + lineDistance;
          }
        }
      });

      setCurrentUserDistances(distances);

      // Save footage data locally if we have distances
      if (Object.keys(distances).length > 0) {
        try {
          const totalDistance = Object.values(distances).reduce((sum, dist) => sum + dist, 0);
          
          const footageData: UserFootageSummary = {
            userName: user.name,
            lastCalculated: new Date().toISOString(),
            distancesByType: distances,
            totalDistance: totalDistance
          };
          
          console.log('💾 Saving footage data locally...', footageData);
          await footageStorageService.saveUserFootage(project.id, user.id, footageData);
          console.log('✅ Footage data saved locally');
          
          // Refresh all users footage data to show the updated data
          await loadAllUsersFootageData();
          
        } catch (saveError) {
          console.error('❌ Failed to save footage data locally:', saveError);
          // Don't show error to user, just log it
        }
      }

    } catch (error) {
      console.error('Error calculating current user distances:', error);
      setCurrentUserDistances({});
    } finally {
      setLoadingDistances(false);
    }
  };



  // Load footage data for all users on this project
  const loadAllUsersFootageData = async () => {
    if (!project) return;

    try {
      const footageData = await footageStorageService.getAllProjectFootage(project.id);
      setAllUsersFootage(footageData || {});
    } catch (error) {
      console.error('Error loading all users footage data:', error);
      setAllUsersFootage({});
    }
  };

  // Format date for display
  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown';
    }
  };

  // Load data when modal opens
  useEffect(() => {
    if (isVisible && project) {
      calculateCurrentUserDistances();
      loadAllUsersFootageData();
    }
  }, [isVisible, project, user]);

  if (!project) return null;

  // Ensure all values are strings and handle special cases
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return 'Not set';
    if (typeof value === 'string') return value;
    // Handle work_type object
    if (typeof value === 'object' && value.name) return value.name;
    return String(value);
  };

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
            <Text style={styles.title}>Project Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Work Order:</Text>
                <Text style={styles.value}>{safeString(project.name)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Client:</Text>
                <Text style={styles.value}>{safeString(project.client_name)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Address:</Text>
                <Text style={styles.value}>{safeString(project.address)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Work Type:</Text>
                <Text style={styles.value}>{safeString(project.work_type)}</Text>
              </View>

              {/* Current User Feature Distances Section */}
              <View style={styles.sectionSeparator} />
              <View style={styles.distanceSection}>
                <Text style={styles.sectionTitle}>Your Feature Distances</Text>
                {loadingDistances ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.DarkBlue} />
                    <Text style={styles.loadingText}>Calculating distances...</Text>
                  </View>
                ) : Object.keys(currentUserDistances).length > 0 ? (
                  <>
                    {Object.entries(currentUserDistances)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([layerName, totalDistance]) => (
                        <View key={layerName} style={styles.distanceRow}>
                          <Text style={styles.distanceLabel}>{layerName}:</Text>
                          <Text style={styles.distanceValue}>
                            {formatDistanceInFeet(totalDistance)}
                          </Text>
                        </View>
                      ))}

                  </>
                ) : (
                  <Text style={styles.noDataText}>No line features found that you created</Text>
                )}
              </View>

              {/* All Users Footage Section */}
              {Object.keys(allUsersFootage).length > 0 && (
                <>
                  <View style={styles.sectionSeparator} />
                  <View style={styles.allUsersSection}>
                    <Text style={styles.sectionTitle}>All Team Members</Text>
                    {Object.entries(allUsersFootage)
                      .sort(([, a], [, b]) => b.lastCalculated.localeCompare(a.lastCalculated))
                      .map(([userId, footageData]) => (
                        <View key={userId} style={styles.userFootageContainer}>
                          <View style={styles.userHeader}>
                            <Text style={styles.userName}>{footageData.userName}</Text>
                            <Text style={styles.userTotal}>
                              Total: {formatDistanceInFeet(footageData.totalDistance)}
                            </Text>
                          </View>
                          <Text style={styles.lastUpdated}>
                            Last updated: {formatDate(footageData.lastCalculated)}
                          </Text>
                          {Object.entries(footageData.distancesByType)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([layerName, distance]) => (
                              <View key={layerName} style={styles.userDistanceRow}>
                                <Text style={styles.userDistanceLabel}>{layerName}:</Text>
                                <Text style={styles.userDistanceValue}>
                                  {formatDistanceInFeet(distance)}
                                </Text>
                              </View>
                            ))}
                        </View>
                      ))}
                  </View>
                </>
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
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '98%',
    maxWidth: 1000,
    maxHeight: '85%',
    minHeight: 400,
  },
  scrollContainer: {
    flex: 1,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.VeryLightGrey,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: Colors.DarkBlue,
    fontSize: 16,
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.Grey,
  },
  value: {
    flex: 2,
    fontSize: 16,
    color: Colors.DarkBlue,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: Colors.VeryLightGrey,
    marginVertical: 8,
  },
  distanceSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
    marginBottom: 8,
  },
  distanceRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.Grey,
    flex: 1,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.DarkBlue,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.Grey,
  },

  noDataText: {
    fontSize: 14,
    color: Colors.Grey,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  allUsersSection: {
    marginTop: 8,
  },
  userFootageContainer: {
    backgroundColor: Colors.VeryLightGrey,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
  },
  userTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.DarkBlue,
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.Grey,
    marginBottom: 8,
  },
  userDistanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  userDistanceLabel: {
    fontSize: 14,
    color: Colors.Grey,
    flex: 1,
  },
  userDistanceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.DarkBlue,
  },
}); 