import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useFeatureContext } from '@/FeatureContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { Position } from '@/types/collection.types';
import { Colors } from '@/theme/colors';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { LINE_POINT_FEATURE, getLinePointSvg } from '@/constants/features';
import { Coordinate } from '@/types/map.types';

const CollectionButton = () => {
  const { isCollecting, startCollection, stopCollection, saveCurrentPoint, currentPoints } = useCollectionContext();
  const { selectedFeature } = useFeatureContext();
  const { currentLocation, locationSource } = useLocationContext();
  const { ggaData, gstData } = useNMEAContext();
  const { addPoint, addLine, removeFeature, clearFeatures } = useMapContext();
  
  // State to track line collection points and IDs of all features created during line collection
  const [linePoints, setLinePoints] = useState<{ id: string; coordinates: Coordinate }[]>([]);
  const [lineFeatureIds, setLineFeatureIds] = useState<string[]>([]);
  const [isCollectingLine, setIsCollectingLine] = useState(false);

  // Helper to convert Position to Coordinate
  const positionToCoordinate = (pos: Position): Coordinate => {
    if (Array.isArray(pos)) {
      return pos;
    }
    return [pos.longitude, pos.latitude];
  };

  // Helper to ensure color has # prefix
  const formatColor = (color?: string) => {
    if (!color) return '#FF6B00'; // Default to orange if no color
    return color.startsWith('#') ? color : `#${color}`;
  };

  // Helper to clean up line collection
  const cleanupLineCollection = () => {
    // Remove all created features
    lineFeatureIds.forEach(id => removeFeature(id));
    setLinePoints([]);
    setLineFeatureIds([]);
    setIsCollectingLine(false);
  };

  // Handle completing line collection
  const handleCompleteLine = async () => {
    if (linePoints.length < 2) {
      Alert.alert("Invalid Line", "A line must have at least 2 points.");
      return;
    }

    try {
      // Generate a unique line ID to group all points
      const lineUniqueId = `line-${Date.now()}`;
      
      // Get the feature color for consistent styling
      const featureColor = formatColor(selectedFeature?.color);
      
      // Save all line points as regular points
      for (let i = 0; i < linePoints.length; i++) {
        const point = linePoints[i];
        // Create a unique ID for each point that's truly unique
        const uniqueId = `${lineUniqueId}-point-${i}`;
        
        // Create a valid Feature object for the LINE_POINT_FEATURE
        const linePointFeature = {
          ...LINE_POINT_FEATURE,
          id: parseInt(LINE_POINT_FEATURE.id.replace('line-point', '1')) + i, // Ensure unique ID for each point
          type: 'Point' as const, // Explicitly typed as 'Point'
          color: featureColor, // Use the selected feature's color
          line_weight: 1,
          dash_pattern: '',
          label: `Line Point ${i + 1}`, // Add sequence number to label
          z_value: 0,
          created_by: 'app',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
          coordinates: point.coordinates,
          image_url: '' // Empty string instead of null
        };
        
        const newState = startCollection(point.coordinates, linePointFeature);
        if (!newState.isActive) continue;

        await saveCurrentPoint({
          name: `${LINE_POINT_FEATURE.name} ${i + 1}`, // Add sequence number to name
          featureType: 'Point',
          draw_layer: LINE_POINT_FEATURE.draw_layer,
          pointId: uniqueId, // Use the truly unique ID we created
          isLinePoint: true, // Mark as a line point for identification
          pointIndex: i, // Add index to identify position in the line
          lineId: selectedFeature?.id, // Add reference to the parent line feature
          lineUniqueId: lineUniqueId, // Add the unique line ID to group points
          color: featureColor, // Include the color
          style: {
            circleRadius: 5, // Size for line points
            circleColor: featureColor, // Use the selected feature's color
            circleOpacity: 1
          }
        }, newState);
      }

      // Save the line itself - use the exact coordinates without closing the line
      const lineCoordinates = linePoints.map(p => p.coordinates);
      
      // Create a new line with the exact coordinates (no auto-closing)
      const lineId = addLine(lineCoordinates, {
        featureId: selectedFeature?.id,
        name: selectedFeature?.name,
        draw_layer: selectedFeature?.draw_layer,
        isOpenLine: true, // Flag to indicate this is an open line (not a closed polygon)
        lineUniqueId: lineUniqueId, // Add the unique line ID to reference the group
        color: featureColor // Use the selected feature's color for the line
      });

      if (lineId) {
        setLineFeatureIds(prev => [...prev, lineId]);
        Alert.alert("Success", "Line collection completed successfully.");
      }
    } catch (error) {
      console.error('Error saving line:', error);
      Alert.alert("Error", "Failed to save line. Please try again.");
    } finally {
      setIsCollectingLine(false);
      setLinePoints([]);
      setLineFeatureIds([]);
    }
  };

  // Handle undoing last point
  const handleUndoPoint = () => {
    if (linePoints.length === 0) return;

    const lastPoint = linePoints[linePoints.length - 1];
    removeFeature(lastPoint.id);
    
    // If there was a line segment connected to this point, remove it too
    const lastLineId = lineFeatureIds[lineFeatureIds.length - 1];
    if (lastLineId) {
      removeFeature(lastLineId);
      setLineFeatureIds(prev => prev.slice(0, -1));
    }

    setLinePoints(prev => prev.slice(0, -1));
  };

  // Handle canceling line collection
  const handleCancelLine = () => {
    Alert.alert(
      "Cancel Line Collection",
      "Are you sure you want to cancel? All collected points will be removed.",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes",
          onPress: () => {
            cleanupLineCollection();
          }
        }
      ]
    );
  };

  // Don't render if not using NMEA
  if (locationSource !== 'nmea') {
    return null;
  }

  const handleCollect = async () => {
    if (!selectedFeature) {
      Alert.alert("No Feature Selected", "Please select a feature first.");
      return;
    }
    
    if (!currentLocation) {
      Alert.alert("No Position", "GNSS position not available.");
      return;
    }
    
    const featureType = selectedFeature.type;
    switch (featureType) {
      case 'Point':
        // Start collection and wait for it to complete
        const newState = startCollection(currentLocation, selectedFeature);
        if (!newState.isActive) {
          console.error('Failed to start collection');
          return;
        }
        
        // Add point to map
        const pointId = addPoint(currentLocation, {
          featureId: selectedFeature.id,
          name: selectedFeature.name,
          draw_layer: selectedFeature.draw_layer
        });
        
        if (!pointId) {
          console.error('Failed to add point to map');
          Alert.alert("Error", "Failed to create point. Please try again.");
          return;
        }
        
        // Try to save the point
        try {
          const success = await saveCurrentPoint({
            name: selectedFeature.name,
            featureType: selectedFeature.type,
            draw_layer: selectedFeature.draw_layer,
            pointId, // This ID is required for map interactions
            style: {
              color: selectedFeature.color
            }
          }, newState);
          
          if (!success) {
            // If save failed, we should remove the point from the map since it wasn't saved
            removeFeature(pointId);
            console.error('Failed to save point');
            Alert.alert("Error", "Failed to save point. Please try again.");
          }
        } catch (error) {
          // Also remove the point from the map if there was an error
          removeFeature(pointId);
          console.error('Error saving point:', error);
          Alert.alert("Error", "An error occurred while saving the point.");
        } finally {
          stopCollection(); // Always stop collection for points
        }
        break;
        
      case 'Line':
        setIsCollectingLine(true);
        const currentCoordinate = positionToCoordinate(currentLocation);
        
        // Get the feature color for consistent styling
        const featureColor = formatColor(selectedFeature.color);
        
        // Add a Line Point at the current location
        const pointIndex = linePoints.length; // Get the current index for this point
        
        // Generate a unique ID for this point that includes the index
        const linePointUniqueId = `linepoint-${Date.now()}-${pointIndex}`;
        
        const linePointId = addPoint(currentCoordinate, {
          featureId: LINE_POINT_FEATURE.id,
          name: `${LINE_POINT_FEATURE.name} ${pointIndex + 1}`, // Add sequence number
          isLinePoint: true, // Flag to identify line points
          pointIndex: pointIndex, // Store the index of this point in the line
          lineId: selectedFeature.id, // Add reference to the parent line
          uniqueId: linePointUniqueId, // Add a truly unique ID
          color: featureColor, // Use the selected feature's color
          properties: {
            isLinePoint: true,
            pointIndex: pointIndex,
            lineId: selectedFeature.id,
            uniqueId: linePointUniqueId,
            name: `${LINE_POINT_FEATURE.name} ${pointIndex + 1}`,
            color: featureColor // Include the color in properties
          },
          style: {
            circleRadius: 5, // Size for line points
            circleColor: featureColor, // Use the selected feature's color
            circleOpacity: 1
          }
        });

        if (linePointId) {
          // Add the point to our linePoints array
          setLinePoints(prev => [...prev, { id: linePointId, coordinates: currentCoordinate }]);
          setLineFeatureIds(prev => [...prev, linePointId]);
          
          // If we have at least 2 points, draw a line between the last two points
          if (linePoints.length > 0) {
            const lastPoint = linePoints[linePoints.length - 1];
            const lineId = addLine([lastPoint.coordinates, currentCoordinate], {
              featureId: selectedFeature.id,
              name: selectedFeature.name,
              isLinePart: true, // Flag to identify line segments
              isOpenLine: true, // Flag to indicate this is an open line (not a closed polygon)
              color: featureColor // Use the selected feature's color for the line
            });
            
            if (lineId) {
              setLineFeatureIds(prev => [...prev, lineId]);
            }
          }
        }
        break;
        
      default:
        console.warn("Unsupported feature type:", featureType);
    }
  };
  
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.button}
        onPress={handleCollect}
        disabled={isCollecting && selectedFeature?.type === 'Point'}
      >
        <MaterialIcons
          name="add-location"
          size={24}
          color={Colors.DarkBlue}
        />
      </TouchableOpacity>

      {/* Line collection controls */}
      {isCollectingLine && selectedFeature?.type === 'Line' && (
        <View style={styles.lineControls}>
          <TouchableOpacity 
            style={[styles.button, styles.controlButton]}
            onPress={handleCompleteLine}
          >
            <MaterialIcons name="check" size={24} color={Colors.BrightGreen} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.controlButton]}
            onPress={handleUndoPoint}
            disabled={linePoints.length === 0}
          >
            <MaterialIcons name="undo" size={24} color={linePoints.length === 0 ? Colors.Grey : Colors.Yellow} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.controlButton]}
            onPress={handleCancelLine}
          >
            <MaterialIcons name="close" size={24} color={Colors.BrightRed} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center'
  },
  button: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lineControls: {
    flexDirection: 'column',
    marginTop: 8,
  },
  controlButton: {
    marginVertical: 4,
  }
});

export default CollectionButton;