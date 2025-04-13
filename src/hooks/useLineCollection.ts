import { useCallback, useState, useEffect, useRef } from 'react';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { generateId } from '@/utils/collections';
import { storageService } from '@/services/storage/storageService';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuthContext } from '@/contexts/AuthContext';

export const useLineCollection = () => {
  const { renderFeature, removeFeature, previewFeature } = useMapContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { currentLocation } = useLocationContext();
  const { ggaData, gstData } = useNMEAContext();
  const { activeProject } = useProjectContext();
  const { user } = useAuthContext();

  const [isCollecting, setIsCollecting] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pointIds, setPointIds] = useState<string[]>([]);
  
  // Use refs to track the latest values without causing re-renders
  const currentPointsRef = useRef<[number, number][]>([]);
  const previewIdRef = useRef<string | null>(null);

  // Update refs when state changes
  useEffect(() => {
    currentPointsRef.current = currentPoints;
    previewIdRef.current = previewId;
  }, [currentPoints, previewId]);

  // Update preview line when current location changes
  useEffect(() => {
    if (!isCollecting || currentPointsRef.current.length === 0 || !currentLocation) {
      return;
    }

    const coordinates: [number, number] = Array.isArray(currentLocation)
      ? currentLocation
      : [currentLocation.longitude, currentLocation.latitude];
    
    const previewLine = [currentPointsRef.current[currentPointsRef.current.length - 1], coordinates];
    
    if (previewIdRef.current) {
      removeFeature(previewIdRef.current);
    }
    const newPreviewId = previewFeature(previewLine, 'line');
    setPreviewId(newPreviewId);
  }, [currentLocation, isCollecting, removeFeature, previewFeature]);

  const handleLineCollection = useCallback(async () => {
    if (!currentLocation || !selectedFeatureType) {
      console.warn('Cannot collect line: No location or feature type selected');
      return;
    }

    try {
      // Get coordinates in the correct format
      const coordinates: [number, number] = Array.isArray(currentLocation)
        ? currentLocation
        : [currentLocation.longitude, currentLocation.latitude];

      if (!isCollecting) {
        // Start collecting - first point
        setIsCollecting(true);
        const newPoints = [coordinates];
        setCurrentPoints(newPoints);
        
        // Generate a unique ID for the point
        const pointClientId = generateId();
        
        // Add point to map
        const pointId = renderFeature({
          type: 'Point',
          coordinates,
          properties: {
            client_id: pointClientId,
            name: selectedFeatureType.name,
            isLinePoint: true,
            style: {
              color: selectedFeatureType.color,
              lineWeight: selectedFeatureType.line_weight,
              dashPattern: selectedFeatureType.dash_pattern
            }
          }
        });
        if (pointId) {
          setPointIds(prev => [...prev, pointId]);
        }
      } else {
        // Add new point to the line
        const newPoints = [...currentPoints, coordinates];
        setCurrentPoints(newPoints);

        // Generate a unique ID for the point
        const pointClientId = generateId();

        // Add point to map
        const pointId = renderFeature({
          type: 'Point',
          coordinates,
          properties: {
            client_id: pointClientId,
            name: selectedFeatureType.name,
            isLinePoint: true,
            style: {
              color: selectedFeatureType.color,
              lineWeight: selectedFeatureType.line_weight,
              dashPattern: selectedFeatureType.dash_pattern
            }
          }
        });
        if (pointId) {
          setPointIds(prev => [...prev, pointId]);
        }

        // If we have 2 or more points, render the last segment as a permanent line
        if (newPoints.length >= 2) {
          const lastSegment = [newPoints[newPoints.length - 2], newPoints[newPoints.length - 1]];
          renderFeature({
            type: 'Line',
            coordinates: lastSegment,
            properties: {
              featureTypeName: selectedFeatureType.name,
              style: {
                color: selectedFeatureType.color,
                lineWeight: selectedFeatureType.line_weight,
                dashPattern: selectedFeatureType.dash_pattern
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error collecting line:', error);
    }
  }, [currentLocation, selectedFeatureType, isCollecting, currentPoints, renderFeature]);

  const cancelLine = useCallback(() => {
    // Remove preview
    if (previewIdRef.current) {
      removeFeature(previewIdRef.current);
      setPreviewId(null);
    }

    // Remove points
    pointIds.forEach(id => removeFeature(id));
    setPointIds([]);

    // Reset state
    setIsCollecting(false);
    setCurrentPoints([]);
  }, [removeFeature, pointIds]);

  const removeLastPoint = useCallback(() => {
    if (currentPoints.length <= 1) {
      // If only one point, cancel the line collection
      cancelLine();
      return;
    }

    const newPoints = currentPoints.slice(0, -1);
    setCurrentPoints(newPoints);

    // Remove last point from map
    const lastPointId = pointIds[pointIds.length - 1];
    if (lastPointId) {
      removeFeature(lastPointId);
      setPointIds(prev => prev.slice(0, -1));
    }
  }, [currentPoints, pointIds, removeFeature, cancelLine]);

  const completeLine = useCallback(async () => {
    if (!currentPoints.length || !selectedFeatureType) {
      console.warn('Cannot complete line: No points collected or no feature type selected');
      return;
    }

    try {
      // Remove preview
      if (previewIdRef.current) {
        removeFeature(previewIdRef.current);
        setPreviewId(null);
      }

      // Create a unique ID for the line
      const clientId = generateId();

      // Create the line feature
      const lineFeature = {
        client_id: clientId,
        project_id: activeProject?.id || 0,
        feature_id: 0, // This will be set by the server
        name: selectedFeatureType.name,
        description: '',
        draw_layer: selectedFeatureType.draw_layer,
        coordinates: currentPoints,
        nmeaData: {
          gga: ggaData || {
            time: new Date().toISOString(),
            latitude: currentPoints[currentPoints.length - 1][1],
            longitude: currentPoints[currentPoints.length - 1][0],
            quality: 1,
            satellites: 8,
            hdop: 1.0,
            altitude: 0,
            altitudeUnit: 'M',
            geoidHeight: 0,
            geoidHeightUnit: 'M'
          },
          gst: gstData || {
            time: new Date().toISOString(),
            rmsTotal: 0,
            semiMajor: 0,
            semiMinor: 0,
            orientation: 0,
            latitudeError: 0,
            longitudeError: 0,
            heightError: 0
          }
        },
        attributes: {
          style: {
            color: selectedFeatureType.color,
            lineWeight: selectedFeatureType.line_weight,
            dashPattern: selectedFeatureType.dash_pattern
          }
        },
        synced: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.id?.toString() || '0',
        updated_by: user?.id?.toString() || '0'
      };

      // Save to storage
      await storageService.saveLine(lineFeature);

      // Reset state
      setIsCollecting(false);
      setCurrentPoints([]);
      setPointIds([]);
    } catch (error) {
      console.error('Error completing line:', error);
    }
  }, [currentPoints, selectedFeatureType, removeFeature, activeProject, ggaData, gstData, user]);

  return {
    handleLineCollection,
    completeLine,
    removeLastPoint,
    cancelLine,
    isCollecting,
    currentPoints
  };
}; 