// linePreviewContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { LinePreviewContextType, LinePreviewState } from '@/types/preview.types';


const LinePreviewContext = createContext<LinePreviewContextType | undefined>(undefined);

export const useLinePreview = () => {
  const context = useContext(LinePreviewContext);
  if (!context) {
    throw new Error('useLinePreview must be used within a LinePreviewProvider');
  }
  return context;
};

export const LinePreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addPoint, addLine, updateFeature } = useMapContext();
  
  const [previewState, setPreviewState] = useState<LinePreviewState>({
    isCollecting: false,
    collectedPoints: [],
    previewLineId: null,
    lastPointId: null
  });

  const startCollection = useCallback(() => {
    setPreviewState({
      isCollecting: true,
      collectedPoints: [],
      previewLineId: null,
      lastPointId: null
    });
  }, []);

  const updatePreview = useCallback((currentPosition: [number, number]) => {
    if (!previewState.isCollecting) return;

    const previewCoordinates = [...previewState.collectedPoints, currentPosition];
    
    if (previewState.previewLineId) {
      updateFeature(previewState.previewLineId, previewCoordinates);
    } else if (previewState.collectedPoints.length > 0) {
      // Only create preview line if we have at least one collected point
      const previewId = addLine(previewCoordinates, { 
        isPreview: true,
        isDashed: true 
      });
      setPreviewState(prev => ({
        ...prev,
        previewLineId: previewId
      }));
    }
  }, [previewState, updateFeature, addLine]);

  const collectPoint = useCallback((coordinates: [number, number]) => {
    if (!previewState.isCollecting) {
      startCollection();
    }

    // Add the individual point
    const pointId = addPoint(coordinates, { 
      isLinePoint: true,
      linePointIndex: previewState.collectedPoints.length 
    });

    // Update the collected points
    const newCollectedPoints = [...previewState.collectedPoints, coordinates];
    
    // If we have at least two points, create or update the actual line
    if (newCollectedPoints.length >= 2) {
      if (previewState.previewLineId) {
        updateFeature(previewState.previewLineId, newCollectedPoints);
      } else {
        const lineId = addLine(newCollectedPoints, { isPreview: true });
        setPreviewState(prev => ({
          ...prev,
          previewLineId: lineId
        }));
      }
    }

    setPreviewState(prev => ({
      ...prev,
      collectedPoints: newCollectedPoints,
      lastPointId: pointId
    }));

    return pointId;
  }, [previewState, addPoint, addLine, updateFeature, startCollection]);

  const finishCollection = useCallback(() => {
    if (!previewState.isCollecting || previewState.collectedPoints.length < 2) return null;

    // Create the final line
    const lineId = addLine(previewState.collectedPoints);

    // Reset the preview state
    setPreviewState({
      isCollecting: false,
      collectedPoints: [],
      previewLineId: null,
      lastPointId: null
    });

    return lineId;
  }, [previewState, addLine]);

  return (
    <LinePreviewContext.Provider value={{
      startCollection,
      updatePreview,
      collectPoint,
      finishCollection,
      isCollecting: previewState.isCollecting,
      collectedPoints: previewState.collectedPoints
    }}>
      {children}
    </LinePreviewContext.Provider>
  );
};