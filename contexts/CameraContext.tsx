import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { CameraRef } from '@maplibre/maplibre-react-native';
import { CameraOptions } from '@/types/camera.types';

interface CameraBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface CameraContextType {
  setCamera: (options: CameraOptions) => void;
  setCameraRef: (ref: CameraRef | null) => void;
  checkBoundingBox: (currentLocation: [number, number]) => boolean;
  boundingBoxPercentage: number;
  setBoundingBoxPercentage: (percentage: number) => void;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const useCameraContext = () => {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCameraContext must be used within a CameraProvider');
  }
  return context;
};

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cameraRef = useRef<CameraRef | null>(null);
  const [lastCenteredLocation, setLastCenteredLocation] = useState<[number, number] | null>(null);
  // Default bounding box is 70% of the visible map - when user goes outside this box, map will recenter
  const [boundingBoxPercentage, setBoundingBoxPercentage] = useState<number>(70);

  const setCamera = useCallback((options: CameraOptions) => {
    if (!cameraRef.current) {
      console.warn("Camera ref not available for movement");
      return;
    }

    try {
      console.log("Setting camera to:", options.centerCoordinate);
      cameraRef.current.setCamera({
        centerCoordinate: options.centerCoordinate,
        animationDuration: options.animationDuration ?? 500
      });
      // Store the centered location for bounding box calculations
      setLastCenteredLocation(options.centerCoordinate);
    } catch (error) {
      console.error("Failed to set camera position:", error);
    }
  }, []);

  const setCameraRef = useCallback((ref: CameraRef | null) => {
    cameraRef.current = ref;
  }, []);

  // Check if current location is outside the bounding box
  // Returns true if we need to recenter the map
  const checkBoundingBox = useCallback(
    (currentLocation: [number, number]): boolean => {
      if (!lastCenteredLocation) {
        // If we don't have a last centered location, we should center
        return true;
      }

      // Calculate how far the user has moved from the last centered position
      const boundingBoxLimit = boundingBoxPercentage / 100;
      
      // Get approximate distances in degrees
      // This is a simplified approach that works well for small distances
      const longitudeDiff = Math.abs(currentLocation[0] - lastCenteredLocation[0]);
      const latitudeDiff = Math.abs(currentLocation[1] - lastCenteredLocation[1]);
      
      // These thresholds are approximate and would need to be tuned based on zoom level
      // For a more accurate approach, you could use the actual visible map bounds
      const longitudeThreshold = 0.001 * boundingBoxLimit; // ~100m at equator (simplified)
      const latitudeThreshold = 0.0009 * boundingBoxLimit; // ~100m (simplified)
      
      // If the user has moved beyond either threshold, we should recenter
      return longitudeDiff > longitudeThreshold || latitudeDiff > latitudeThreshold;
    },
    [lastCenteredLocation, boundingBoxPercentage]
  );

  return (
    <CameraContext.Provider value={{
      setCamera,
      setCameraRef,
      checkBoundingBox,
      boundingBoxPercentage,
      setBoundingBoxPercentage
    }}>
      {children}
    </CameraContext.Provider>
  );
};

export default CameraProvider;