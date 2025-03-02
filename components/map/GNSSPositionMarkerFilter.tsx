import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocationContext } from '@/contexts/LocationContext';
import { useCameraContext } from '@/contexts/CameraContext';
import type { Position as GeoPosition, FeatureCollection } from 'geojson';
import { ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native';
import { FilteredPositionMarkerProps } from '@/types/GNSSPosition.types';

// Minimum distance in meters to trigger a position update
const MIN_DISTANCE_THRESHOLD = 5; 

// Haversine formula to calculate distance between two points in meters
const getDistanceInMeters = (
  lon1: number, 
  lat1: number, 
  lon2: number, 
  lat2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Create a crosshair SVG icon as a data URL
const createCrosshairIcon = (color: string): string => {
  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2V7" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 17V22" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M2 12H7" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M17 12H22" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="2" fill="${color}"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
};

const FilteredPositionMarker: React.FC<FilteredPositionMarkerProps> = ({
  color = '#FF6B00',
  size = 1.0,
  minDistanceThreshold = MIN_DISTANCE_THRESHOLD
}) => {
  const { currentLocation } = useLocationContext();
  const { setCamera } = useCameraContext();
  const [filteredPosition, setFilteredPosition] = useState<[number, number] | null>(null);
  const lastPositionRef = useRef<[number, number] | null>(null);
  
  // Create crosshair icon
  const crosshairIcon = useMemo(() => createCrosshairIcon(color), [color]);

  // Check if we should recenter based on how far we've moved
  // This implementation doesn't rely on checkBoundingBox from CameraContext
  const shouldRecenter = (current: [number, number], last: [number, number] | null): boolean => {
    if (!last) return true;
    
    // These thresholds determine when we need to recenter
    // Adjust these values based on your needs
    const longitudeThreshold = 0.0007; // Approximately 70% of visible area on zoom level 18
    const latitudeThreshold = 0.0006; // Approximately 70% of visible area on zoom level 18
    
    const longitudeDiff = Math.abs(current[0] - last[0]);
    const latitudeDiff = Math.abs(current[1] - last[1]);
    
    return longitudeDiff > longitudeThreshold || latitudeDiff > latitudeThreshold;
  };

  useEffect(() => {
    // If we don't have a current location, don't update
    if (!currentLocation) return;
    
    // If we don't have a previous filtered position, update immediately
    if (!lastPositionRef.current) {
      setFilteredPosition(currentLocation);
      lastPositionRef.current = currentLocation;
      
      // Center camera on first position
      setCamera({
        centerCoordinate: currentLocation,
        animationDuration: 500
      });
      return;
    }
    
    // Calculate distance between last filtered position and current position
    const distance = getDistanceInMeters(
      lastPositionRef.current[0], 
      lastPositionRef.current[1],
      currentLocation[0], 
      currentLocation[1]
    );
    
    // Only update if we've moved more than the threshold distance
    if (distance > minDistanceThreshold) {
      setFilteredPosition(currentLocation);
      lastPositionRef.current = currentLocation;
      
      // Check if we need to recenter the map
      const needsRecentering = shouldRecenter(currentLocation, lastPositionRef.current);
      if (needsRecentering) {
        setCamera({
          centerCoordinate: currentLocation,
          animationDuration: 500
        });
      }
    }
  }, [currentLocation, minDistanceThreshold, setCamera]);

  // Create properly typed GeoJSON feature for the filtered position
  const positionFeature = useMemo((): FeatureCollection => {
    if (!filteredPosition) return {
      type: 'FeatureCollection',
      features: []
    };
    
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: filteredPosition as GeoPosition
        }
      }]
    };
  }, [filteredPosition]);

  if (!filteredPosition) return null;

  return (
    <ShapeSource
      id="filteredPositionSource"
      shape={positionFeature}
    >
      <SymbolLayer
        id="filteredPositionCrosshair"
        style={{
          iconImage: crosshairIcon,
          iconSize: size,
          iconAllowOverlap: true,
          iconIgnorePlacement: true
        }}
      />
    </ShapeSource>
  );
};

export default FilteredPositionMarker;