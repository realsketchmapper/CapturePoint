import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useCollectionContext } from '../contexts/CollectionContext';
import { useFeatureTypeContext } from '../contexts/FeatureTypeContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useMapContext } from '../contexts/MapDisplayContext';
import { LINE_POINT_FEATURE } from '../constants/features';
import { Position } from '../types/collection.types';
import { Coordinate } from '../types/map.types';
import { FeatureType } from '../types/featureType.types';
import { Colors } from '@/theme/colors';

export const useLineCollection = () => {
  const { startCollection, saveCurrentPoint } = useCollectionContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { currentLocation } = useLocationContext();
  const { addPoint, addLine, removeFeature, setVisibleLayers, visibleLayers } = useMapContext();
  
  // State to track line collection points and IDs of all features created during line collection
  const [linePoints, setLinePoints] = useState<{ id: string; coordinates: Coordinate }[]>([]);
  const [lineFeatureIds, setLineFeatureIds] = useState<string[]>([]);
  const [isCollectingLine, setIsCollectingLine] = useState(false);
  const [tempLineId, setTempLineId] = useState<string | null>(null);

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
    if (tempLineId) {
      removeFeature(tempLineId);
      setTempLineId(null);
    }
    setLinePoints([]);
    setLineFeatureIds([]);
    setIsCollectingLine(false);
  };

  // Update temporary line when current location changes
  useEffect(() => {
    if (!isCollectingLine || linePoints.length === 0 || !currentLocation) return;

    const currentCoordinate = positionToCoordinate(currentLocation);
    const lastPoint = linePoints[linePoints.length - 1];

    // Remove old temporary line if it exists
    if (tempLineId) {
      removeFeature(tempLineId);
    }

    // Add new temporary line
    const newTempLineId = addLine([lastPoint.coordinates, currentCoordinate], {
      featureTypeId: 'temp-line',
      name: 'Temporary Line',
      draw_layer: 'temp_lines',
      isLinePart: true,
      isOpenLine: true,
      properties: {
        style: {
          lineColor: selectedFeatureType?.color || Colors.Aqua,
          lineWidth: 2,
          lineOpacity: 0.8,
          lineDasharray: [4, 4] // Dashed line for temporary
        }
      }
    });

    if (newTempLineId) {
      setTempLineId(newTempLineId);
    }
  }, [currentLocation, isCollectingLine, linePoints]);

  // Ensure temp_lines layer is visible when collecting
  useEffect(() => {
    if (isCollectingLine && !visibleLayers['temp_lines']) {
      setVisibleLayers({
        ...visibleLayers,
        'temp_lines': true
      });
    }
  }, [isCollectingLine, setVisibleLayers]);

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

    if (!isCollectingLine) {
      setIsCollectingLine(true);
    }

    const currentCoordinate = positionToCoordinate(currentLocation);
    
    // Add a Line Point at the current location
    const pointIndex = linePoints.length;
    const linePointUniqueId = `linepoint-${Date.now()}-${pointIndex}`;
    
    const linePointId = addPoint(currentCoordinate, {
      featureTypeId: selectedFeatureType.name,
      name: `${selectedFeatureType.name} ${pointIndex + 1}`,
      isLinePoint: true,
      pointIndex: pointIndex,
      lineTypeId: selectedFeatureType.name,
      uniqueId: linePointUniqueId,
      color: selectedFeatureType.color,
      draw_layer: selectedFeatureType.draw_layer,
      featureType: selectedFeatureType,
      properties: {
        isLinePoint: true,
        pointIndex: pointIndex,
        lineTypeId: selectedFeatureType.name,
        uniqueId: linePointUniqueId,
        color: selectedFeatureType.color,
        featureType: selectedFeatureType,
        style: {
          circleRadius: 6,
          circleColor: selectedFeatureType.color,
          circleOpacity: 1,
          circleStrokeWidth: 2,
          circleStrokeColor: selectedFeatureType.color,
          circleStrokeOpacity: 1
        }
      },
      style: {
        circleRadius: 6,
        circleColor: selectedFeatureType.color,
        circleOpacity: 1,
        circleStrokeWidth: 2,
        circleStrokeColor: selectedFeatureType.color,
        circleStrokeOpacity: 1
      }
    });

    if (linePointId) {
      setLinePoints(prev => [...prev, { id: linePointId, coordinates: currentCoordinate }]);
      setLineFeatureIds(prev => [...prev, linePointId]);
      
      // If we have at least 2 points, draw a permanent line between the last two points
      if (linePoints.length > 0) {
        const lastPoint = linePoints[linePoints.length - 1];
        const lineId = addLine([lastPoint.coordinates, currentCoordinate], {
          featureTypeId: selectedFeatureType.name,
          name: selectedFeatureType.name,
          draw_layer: selectedFeatureType.draw_layer,
          isLinePart: true,
          isOpenLine: true,
          color: selectedFeatureType.color,
          properties: {
            color: selectedFeatureType.color,
            style: {
              lineColor: selectedFeatureType.color,
              lineWidth: 2,
              lineOpacity: 1,
              lineDasharray: selectedFeatureType.dash_pattern ? selectedFeatureType.dash_pattern.split(',').map(Number) : [] // Use feature type's dash pattern or solid line
            }
          }
        });
        
        if (lineId) {
          setLineFeatureIds(prev => [...prev, lineId]);
        }
      }
    }
  };

  // Handle completing the line
  const handleCompleteLine = async () => {
    if (linePoints.length < 2) {
      Alert.alert("Not Enough Points", "You need at least 2 points to complete a line.");
      return;
    }

    // Save the line to storage
    const lineCoordinates = linePoints.map(point => point.coordinates);
    await saveCurrentPoint({
      name: selectedFeatureType?.name || 'Line',
      draw_layer: selectedFeatureType?.draw_layer || 'default',
      attributes: {
        coordinates: lineCoordinates,
        featureTypeName: selectedFeatureType?.name
      }
    }, {
      points: lineCoordinates,
      isActive: true,
      activeFeatureType: selectedFeatureType as FeatureType,
      metadata: {
        name: selectedFeatureType?.name || 'Line',
        description: '',
        project_id: 0,
        created_by: 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: 'unknown'
      }
    });

    // Only clean up temporary features
    if (tempLineId) {
      removeFeature(tempLineId);
      setTempLineId(null);
    }
    setIsCollectingLine(false);
  };

  // Handle undoing the last point
  const handleUndoPoint = () => {
    if (linePoints.length === 0) return;

    // Remove the last point and its associated line
    const lastPoint = linePoints[linePoints.length - 1];
    const lastPointId = lastPoint.id;
    removeFeature(lastPointId);
    
    // Remove the line if it exists
    if (linePoints.length > 1) {
      const lastLineId = lineFeatureIds[lineFeatureIds.length - 1];
      removeFeature(lastLineId);
      setLineFeatureIds(prev => prev.slice(0, -1));
    }

    setLinePoints(prev => prev.slice(0, -1));
    setLineFeatureIds(prev => prev.filter(id => id !== lastPointId));
  };

  // Handle canceling line collection
  const handleCancelLine = () => {
    cleanupLineCollection();
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