import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { LineLayer, ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import { Feature, FeatureCollection } from 'geojson';
import { generateId } from '@/utils/collections';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { Position, Coordinates } from '@/types/collection.types';
import { Coordinate } from '@/types/map.types';

/**
 * Converts a Position to a Coordinate array [longitude, latitude]
 */
const positionToCoordinate = (position: Position): Coordinate => {
  if (Array.isArray(position)) {
    return position;
  }
  return [position.longitude, position.latitude];
};

interface LineCollectionManagerProps {
  onComplete?: (points: Coordinates[], lineId: string, pointIds: string[]) => void;
}

export const LineCollectionManager: React.FC<LineCollectionManagerProps> = ({ onComplete }) => {
  const {
    isCollecting,
    currentPoints,
    activeFeatureType,
    stopCollection,
    clearCollection,
    collectionState
  } = useCollectionContext();
  
  const { currentLocation } = useLocationContext();
  const { addLine, addPoint, updateFeature, removeFeature } = useMapContext();
  
  // Reference to store the ID of the preview line
  const previewLineId = useRef<string | undefined>();
  // Reference to store the ID of the permanent line
  const permanentLineId = useRef<string | undefined>();
  // Reference to store point IDs
  const pointIds = useRef<string[]>([]);
  // Store previous active feature type to detect changes
  const prevFeatureTypeRef = useRef<string | null>(null);
  
  // State for line collection
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  
  // Determine if the current feature type is a line
  const isLineFeature = useMemo(() => {
    return activeFeatureType?.type === 'Line';
  }, [activeFeatureType]);
  
  // Memoize the feature color to avoid re-renders when the color doesn't change
  const featureColor = useMemo(() => {
    return validateColor(activeFeatureType?.color || '#FFCC00');
  }, [activeFeatureType?.color]);
  
  // Cleanup function for preview features
  const cleanupPreviewFeatures = useCallback(() => {
    if (previewLineId.current) {
      removeFeature(previewLineId.current);
      previewLineId.current = undefined;
    }
  }, [removeFeature]);

  // Effect to clean up preview features when collection stops
  useEffect(() => {
    if (!isCollecting) {
      cleanupPreviewFeatures();
    }
    return () => {
      cleanupPreviewFeatures();
    };
  }, [isCollecting, cleanupPreviewFeatures]);

  // Generate permanent IDs for points when they're added
  useEffect(() => {
    const previousLength = pointIds.current.length;
    // Only generate IDs for new points
    while (pointIds.current.length < currentPoints.length) {
      const newId = generateId();
      pointIds.current.push(newId);
      console.log(`🔢 Generated new point ID: ${newId} for point index ${pointIds.current.length - 1}`);
    }
    
    if (pointIds.current.length > previousLength) {
      console.log(`📊 Point IDs updated: ${previousLength} → ${pointIds.current.length}`, pointIds.current);
    }
  }, [currentPoints.length]);

  // Reset line ID when activeFeatureType changes and generate permanent line ID when collection starts
  useEffect(() => {
    // Check if the feature type has changed
    const currentFeatureTypeName = activeFeatureType?.name || null;
    
    if (currentFeatureTypeName !== prevFeatureTypeRef.current && isCollecting) {
      // Feature type has changed - reset line ID and point IDs
      console.log(`🔄 Feature type changed from ${prevFeatureTypeRef.current} to ${currentFeatureTypeName}, resetting line IDs`);
      permanentLineId.current = generateId(); // Generate a new ID immediately
      const oldPointIds = [...pointIds.current];
      pointIds.current = []; // Reset point IDs
      console.log(`🗑️ Cleared point IDs: ${oldPointIds.length} IDs removed`);
      
      // If we have current points, we need IDs for them
      while (pointIds.current.length < currentPoints.length) {
        const newId = generateId();
        pointIds.current.push(newId);
        console.log(`🆕 Regenerated point ID: ${newId} for point index ${pointIds.current.length - 1}`);
      }
      
      console.log(`🔢 Final point IDs after feature type change:`, pointIds.current);
    } else if (isCollecting && !permanentLineId.current) {
      // Starting a new collection with the same feature type
      permanentLineId.current = generateId();
      console.log(`🚀 Started new line collection with ID: ${permanentLineId.current}`);
    }
    
    // Update the previous feature type reference
    prevFeatureTypeRef.current = currentFeatureTypeName;
  }, [isCollecting, activeFeatureType]);

  // Create a feature collection for the preview line (dashed line to current position)
  const previewLineFeature = useMemo((): FeatureCollection => {
    if (!isCollecting || !isLineFeature || !currentLocation || currentPoints.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    const lastPoint = currentPoints[currentPoints.length - 1];
    const currentPosition = positionToCoordinate(currentLocation);
    
    // Use a consistent ID for the preview line
    if (!previewLineId.current) {
      previewLineId.current = generateId();
    }
    
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: previewLineId.current,
          properties: {
            isPreview: true
          },
          geometry: {
            type: 'LineString',
            coordinates: [lastPoint, currentPosition]
          }
        }
      ]
    };
  }, [isCollecting, isLineFeature, currentLocation, currentPoints.length > 0 ? currentPoints[currentPoints.length - 1] : null]);

  // Create feature collection for the permanent line (solid line between collected points)
  const permanentLineFeature = useMemo((): FeatureCollection => {
    if (!isCollecting || !isLineFeature || currentPoints.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: permanentLineId.current,
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: currentPoints
          }
        }
      ]
    };
  }, [isCollecting, isLineFeature, currentPoints.length >= 2 ? [...currentPoints] : [], permanentLineId.current]);

  // Create feature collection for point markers
  const pointMarkersFeature = useMemo((): FeatureCollection => {
    if (!isCollecting || !isLineFeature || currentPoints.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    // Create a point feature for each collected point
    return {
      type: 'FeatureCollection',
      features: currentPoints.map((point, index) => {
        const pointId = pointIds.current[index];
        return {
          type: 'Feature',
          id: pointId,
          properties: {
            pointIndex: index,
            isLinePoint: true,
            style: {
              circleRadius: 6,
              circleColor: featureColor,
              circleOpacity: 0.9,
              circleStrokeWidth: 2,
              circleStrokeColor: 'white',
              circleStrokeOpacity: 0.8
            }
          },
          geometry: {
            type: 'Point',
            coordinates: point
          }
        };
      })
    };
  }, [isCollecting, isLineFeature, currentPoints.length > 0 ? [...currentPoints] : [], featureColor, pointIds.current]);
  
  // Create feature for current point indicator (where the next point will be placed)
  const currentPositionIndicator = useMemo((): FeatureCollection => {
    if (!isCollecting || !isLineFeature || !currentLocation) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    const currentPosition = positionToCoordinate(currentLocation);
    
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: generateId(),
          properties: {
            style: {
              circleRadius: 5,
              circleColor: 'white',
              circleOpacity: 0.9,
              circleStrokeWidth: 3,
              circleStrokeColor: featureColor,
              circleStrokeOpacity: 0.9
            }
          },
          geometry: {
            type: 'Point',
            coordinates: currentPosition
          }
        }
      ]
    };
  }, [
    isCollecting, 
    isLineFeature, 
    currentLocation ? 
      (Array.isArray(currentLocation) 
        ? `${currentLocation[0].toFixed(6)}-${currentLocation[1].toFixed(6)}`
        : `${currentLocation.longitude.toFixed(6)}-${currentLocation.latitude.toFixed(6)}`) 
      : null,
    featureColor
  ]);
  
  // Render circle layer styles
  const pointStrokeStyle = useMemo(() => ({
    circleRadius: 7,
    circleColor: 'white',
    circleOpacity: 0.8,
    circleStrokeWidth: 2,
    circleStrokeColor: featureColor
  }), [featureColor]);
  
  const pointCircleStyle = useMemo(() => ({
    circleRadius: 6,
    circleColor: featureColor,
    circleOpacity: 0.9,
  }), [featureColor]);
  
  const lineStyle = useMemo(() => ({
    lineWidth: activeFeatureType?.line_weight || 3,
    lineColor: featureColor,
    lineOpacity: 1.0
  }), [featureColor, activeFeatureType?.line_weight]);
  
  const dashedLineStyle = useMemo(() => ({
    lineWidth: activeFeatureType?.line_weight || 3,
    lineColor: featureColor,
    lineDasharray: [2, 2],
    lineOpacity: 0.8
  }), [featureColor, activeFeatureType?.line_weight]);
  
  // Pulse effect styles
  const pulseStyle = useMemo(() => ({
    circleRadius: 12,
    circleColor: featureColor,
    circleOpacity: 0.3,
    circleStrokeWidth: 2,
    circleStrokeColor: featureColor,
    circleStrokeOpacity: 0.5
  }), [featureColor]);
  
  // Inner circle styles
  const innerCircleStyle = useMemo(() => ({
    circleRadius: 5,
    circleColor: 'white',
    circleOpacity: 0.9,
    circleStrokeWidth: 3,
    circleStrokeColor: featureColor,
    circleStrokeOpacity: 0.9
  }), [featureColor]);
  
  // Log when collection state changes
  useEffect(() => {
    console.log('Collection state changed:', { 
      isCollecting, 
      isLineFeature, 
      pointCount: currentPoints.length,
      canUndo: isCollecting && currentPoints.length > 1,
      canComplete: isCollecting && currentPoints.length >= 2,
      activeFeatureType: activeFeatureType?.name
    });
  }, [isCollecting, isLineFeature, currentPoints.length, activeFeatureType]);
  
  // Update the preview line when the current location changes
  useEffect(() => {
    if (isCollecting && isLineFeature && currentLocation && currentPoints.length > 0) {
      setIsDrawingLine(true);
    } else {
      setIsDrawingLine(false);
    }
  }, [isCollecting, isLineFeature, currentLocation, currentPoints.length]);
  
  // Update the permanent line when new points are added
  useEffect(() => {
    // Only update if we're actively collecting and have at least 2 points
    if (isCollecting && isLineFeature && currentPoints.length >= 2 && permanentLineId.current) {
      // Update the existing line with new coordinates
      console.log('Updating line with ID:', permanentLineId.current, 'Points:', currentPoints.length);
      updateFeature(permanentLineId.current, currentPoints as Coordinate[]);
    }
  }, [
    isCollecting, 
    isLineFeature, 
    // Use JSON.stringify to create a stable dependency
    JSON.stringify(currentPoints),
    updateFeature
  ]);
  
  // When collection stops, handle line completion
  const wasCollecting = useRef(false);
  const isFinishedRef = useRef(false);
  const [showTransitionPoints, setShowTransitionPoints] = useState(false);
  const transitionPointsRef = useRef<Coordinates[]>([]);
  
  useEffect(() => {
    // Check if collection has changed from active to finished (not just any inactive state)
    const isFinished = !isCollecting && collectionState?.finished === true;
    
    if (isFinished && !isFinishedRef.current) {
      isFinishedRef.current = true;
      
      // If we've stopped collecting and have at least 2 points, call onComplete
      if (currentPoints.length >= 2 && onComplete) {
        console.log('Line collection completed with points:', currentPoints.length);
        console.log('Permanent line ID is:', permanentLineId.current);
        
        // Validate all coordinates before passing them on
        const validPoints = currentPoints.filter((point, index) => {
          if (!Array.isArray(point) || point.length !== 2) return false;
          const [lon, lat] = point;
          return (
            typeof lon === 'number' && !isNaN(lon) && 
            typeof lat === 'number' && !isNaN(lat)
          );
        });
        
        if (validPoints.length < 2) {
          console.error(`Line has insufficient valid points (${validPoints.length}), cannot complete`);
          permanentLineId.current = undefined;
          pointIds.current = [];
          clearCollection();
          return;
        }
        
        // IMPORTANT: Make a COPY of the points to pass to the callback
        const pointsCopy = [...validPoints];
        
        // Keep track of the line ID so we don't lose it
        const savedLineId = permanentLineId.current;
        const savedPointIds = [...pointIds.current];
        
        // Keep points visible during transition
        transitionPointsRef.current = pointsCopy;
        setShowTransitionPoints(true);
        
        // Call onComplete with a copy of the points and all IDs
        onComplete(pointsCopy, savedLineId!, savedPointIds);
        
        // We DELIBERATELY leave the line visible on the map
        // The parent component is responsible for reloading features which will
        // eventually replace this temporary line with the stored version
        console.log(`Line ${savedLineId} remains visible while saving to storage`);
        
        // Reset permanentLineId and pointIds after calling onComplete
        permanentLineId.current = undefined;
        
        // Set a timeout to clear the transition points after they should be loaded from storage
        setTimeout(() => {
          setShowTransitionPoints(false);
          transitionPointsRef.current = [];
          // Now it's safe to completely clear the collection state
          clearCollection();
          pointIds.current = [];
        }, 1000);
      } else {
        console.log('Line collection stopped with insufficient points:', currentPoints.length);
        // Clear references for aborted lines
        previewLineId.current = undefined;
        permanentLineId.current = undefined;
        pointIds.current = [];
        setShowTransitionPoints(false);
        transitionPointsRef.current = [];
        
        // Clear the collection state
        clearCollection();
      }
    } else if (isCollecting) {
      isFinishedRef.current = false;
      wasCollecting.current = true;
    }
  }, [isCollecting, currentPoints, onComplete, clearCollection, collectionState]);
  
  return (
    <>
      {/* Render point markers for each collected point */}
      {(isCollecting || showTransitionPoints) && isLineFeature && (
        <ShapeSource 
          id="point-markers-source" 
          shape={showTransitionPoints ? {
            type: 'FeatureCollection',
            features: transitionPointsRef.current.map((point, index) => ({
              type: 'Feature',
              id: pointIds.current[index],
              properties: {
                pointIndex: index,
                isLinePoint: true,
                style: {
                  circleRadius: 6,
                  circleColor: featureColor,
                  circleOpacity: 0.9,
                  circleStrokeWidth: 2,
                  circleStrokeColor: 'white',
                  circleStrokeOpacity: 0.8
                }
              },
              geometry: {
                type: 'Point',
                coordinates: point
              }
            }))
          } : pointMarkersFeature}
          key="point-markers-source"
        >
          {/* White border */}
          <CircleLayer
            id="point-markers-stroke"
            style={pointStrokeStyle}
          />
          {/* Main circle */}
          <CircleLayer
            id="point-markers-circle"
            style={pointCircleStyle}
          />
        </ShapeSource>
      )}
      
      {/* Render permanent line between collected points */}
      {(isCollecting || showTransitionPoints) && isLineFeature && (currentPoints.length >= 2 || transitionPointsRef.current.length >= 2) && (
        <ShapeSource 
          id="permanent-line-source" 
          shape={showTransitionPoints ? {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              id: permanentLineId.current,
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: transitionPointsRef.current
              }
            }]
          } : permanentLineFeature}
          key="permanent-line-source"
        >
          <LineLayer
            id="permanent-line-layer"
            style={lineStyle}
          />
        </ShapeSource>
      )}
      
      {/* Current position indicator (next point to be placed) */}
      {isCollecting && isLineFeature && currentLocation && (
        <ShapeSource 
          id="current-position-indicator-source" 
          shape={currentPositionIndicator}
          key="current-position-indicator-source"
        >
          {/* Animated pulse effect */}
          <CircleLayer
            id="current-position-pulse"
            style={pulseStyle}
          />
          {/* Inner circle */}
          <CircleLayer
            id="current-position-inner"
            style={innerCircleStyle}
          />
        </ShapeSource>
      )}
      
      {/* Render the preview line (dashed line to current position) */}
      {isDrawingLine && (
        <ShapeSource 
          id="preview-line-source" 
          shape={previewLineFeature}
          key="preview-line-source"
        >
          <LineLayer
            id="preview-line-layer"
            style={dashedLineStyle}
          />
        </ShapeSource>
      )}
    </>
  );
};

// Helper function to validate color format
const validateColor = (color: string | undefined): string => {
  if (!color) return '#000000';
  
  // Ensure color starts with #
  if (!color.startsWith('#')) {
    // If color is a valid hex without #, add it
    if (/^[0-9A-Fa-f]{6}$/.test(color)) {
      return `#${color}`;
    }
    // Invalid color, use default
    console.warn('Invalid color format in LineCollectionManager:', color);
    return '#000000';
  }
  
  return color;
}; 