import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useCollectionContext } from '../contexts/CollectionContext';
import { useFeatureTypeContext } from '../contexts/FeatureTypeContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useMapContext } from '../contexts/MapDisplayContext';
import { LINE_POINT_FEATURE } from '../constants/features';
import { Position } from '../types/collection.types';
import { Coordinate } from '../types/map.types';
import { FeatureType } from '../types/featureType.types';

export const useLineCollection = () => {
  const { startCollection, saveCurrentPoint } = useCollectionContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { currentLocation } = useLocationContext();
  const { addPoint, addLine, removeFeature } = useMapContext();
  
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

  // Helper to clean up line collection
  const cleanupLineCollection = () => {
    lineFeatureIds.forEach(id => removeFeature(id));
    setLinePoints([]);
    setLineFeatureIds([]);
    setIsCollectingLine(false);
  };

  // Handle line point collection
  const handleLinePointCollection = async () => {
    if (!selectedFeatureType) {
      Alert.alert("No Feature Type Selected", "Please select a feature type first.");
      return;
    }
    
    if (!currentLocation) {
      Alert.alert("No Position", "GNSS position not available.");
      return;
    }

    setIsCollectingLine(true);
    const currentCoordinate = positionToCoordinate(currentLocation);
    
    // Add a Line Point at the current location
    const pointIndex = linePoints.length;
    const linePointUniqueId = `linepoint-${Date.now()}-${pointIndex}`;
    
    const linePointId = addPoint(currentCoordinate, {
      featureTypeId: LINE_POINT_FEATURE.name,
      name: `${LINE_POINT_FEATURE.name} ${pointIndex + 1}`,
      isLinePoint: true,
      pointIndex: pointIndex,
      lineTypeId: selectedFeatureType.name,
      uniqueId: linePointUniqueId,
      color: selectedFeatureType?.color,
      properties: {
        isLinePoint: true,
        pointIndex: pointIndex,
        lineTypeId: selectedFeatureType.name,
        uniqueId: linePointUniqueId,
      },
    });

    if (linePointId) {
      setLinePoints(prev => [...prev, { id: linePointId, coordinates: currentCoordinate }]);
      setLineFeatureIds(prev => [...prev, linePointId]);
      
      // If we have at least 2 points, draw a line between the last two points
      if (linePoints.length > 0) {
        const lastPoint = linePoints[linePoints.length - 1];
        const lineId = addLine([lastPoint.coordinates, currentCoordinate], {
          featureTypeId: selectedFeatureType.name,
          name: selectedFeatureType.name,
          draw_layer: selectedFeatureType.draw_layer,
          isLinePart: true,
          isOpenLine: true,
        });
        
        if (lineId) {
          setLineFeatureIds(prev => [...prev, lineId]);
        }
      }
    }
  };

  // Handle completing line collection
  const handleCompleteLine = async () => {
    if (linePoints.length < 2) {
      Alert.alert("Invalid Line", "A line must have at least 2 points.");
      return;
    }

    try {
      const lineUniqueId = `line-${Date.now()}`;
      
      // Save all line points as regular points
      for (let i = 0; i < linePoints.length; i++) {
        const point = linePoints[i];
        const uniqueId = `${lineUniqueId}-point-${i}`;
        
        if (!selectedFeatureType) continue;
        const newState = startCollection(point.coordinates, selectedFeatureType);
        if (!newState.isActive) continue;

        await saveCurrentPoint({
          name: `${LINE_POINT_FEATURE.name} ${i + 1}`,
          featureTypeId: LINE_POINT_FEATURE.name,
          draw_layer: LINE_POINT_FEATURE.draw_layer,
          pointId: uniqueId,
          isLinePoint: true,
          pointIndex: i,
          lineTypeId: selectedFeatureType.name,
          lineUniqueId: lineUniqueId,
          style: {
            color: selectedFeatureType.color,
            svg: LINE_POINT_FEATURE.svg
          }
        }, newState);
      }

      // Save the line itself
      const lineCoordinates = linePoints.map(p => p.coordinates);
      const lineId = addLine(lineCoordinates, {
        featureTypeId: selectedFeatureType?.name,
        name: selectedFeatureType?.name,
        draw_layer: selectedFeatureType?.draw_layer,
        isOpenLine: true,
        lineUniqueId: lineUniqueId,
        color: selectedFeatureType?.color
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
          onPress: cleanupLineCollection
        }
      ]
    );
  };

  return {
    isCollectingLine,
    linePoints,
    handleLinePointCollection,
    handleCompleteLine,
    handleUndoPoint,
    handleCancelLine
  };
}; 