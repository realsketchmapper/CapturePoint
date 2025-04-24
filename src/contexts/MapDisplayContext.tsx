import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Feature, Point, FeatureCollection, GeoJsonProperties } from 'geojson';
import { FeatureToRender } from '@/types/featuresToRender.types';
import { MapContextType, Coordinate, FeatureType } from '@/types/map.types';
import { syncService } from '@/services/sync/syncService';
import { useProjectContext } from './ProjectContext';
import { useFeatureTypeContext } from './FeatureTypeContext';
import { featureStorageService } from '@/services/storage/featureStorageService';

const MapContext = createContext<MapContextType | undefined>(undefined);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};

// Define action types
type MapAction = 
  | { type: 'SET_MAP_READY'; payload: boolean }
  | { type: 'ADD_FEATURE'; payload: Feature }
  | { type: 'UPDATE_FEATURE'; payload: { id: string; feature: Feature } }
  | { type: 'REMOVE_FEATURE'; payload: string }
  | { type: 'CLEAR_FEATURES' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SYNC_STATUS'; payload: { isSyncing: boolean; lastSyncTime: string | null } }
  | { type: 'SET_VISIBLE_LAYERS'; payload: Record<string, boolean> }
  | { type: 'TOGGLE_LAYER'; payload: string };

// Define initial state
interface MapState {
  isMapReady: boolean;
  features: FeatureCollection;
  error: string | null;
  isSyncing: boolean;
  lastSyncTime: string | null;
  visibleLayers: Record<string, boolean>;
}

const initialState: MapState = {
  isMapReady: false,
  features: {
    type: 'FeatureCollection',
    features: []
  },
  error: null,
  isSyncing: false,
  lastSyncTime: null,
  visibleLayers: {}
};

// Reducer function
function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'SET_MAP_READY':
      return { 
        ...state, 
        isMapReady: action.payload 
      };
    case 'ADD_FEATURE':
      return { 
        ...state, 
        features: {
          ...state.features,
          features: [...state.features.features, action.payload]
        }
      };
    case 'UPDATE_FEATURE':
      return { 
        ...state, 
        features: {
          ...state.features,
          features: state.features.features.map(feature => 
            feature.id === action.payload.id ? action.payload.feature : feature
          )
        }
      };
    case 'REMOVE_FEATURE':
      return { 
        ...state, 
        features: {
          ...state.features,
          features: state.features.features.filter(feature => feature.id !== action.payload)
        }
      };
    case 'CLEAR_FEATURES':
      return { 
        ...state, 
        features: {
          type: 'FeatureCollection',
          features: []
        }
      };
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload 
      };
    case 'SET_SYNC_STATUS':
      return {
        ...state,
        isSyncing: action.payload.isSyncing,
        lastSyncTime: action.payload.lastSyncTime
      };
    case 'SET_VISIBLE_LAYERS':
      return {
        ...state,
        visibleLayers: action.payload
      };
    case 'TOGGLE_LAYER':
      return {
        ...state,
        visibleLayers: {
          ...state.visibleLayers,
          [action.payload]: !state.visibleLayers[action.payload]
        }
      };
    default:
      return state;
  }
}

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(mapReducer, initialState);
  const { activeProject } = useProjectContext();
  const { featureTypes, getFeatureTypeByName } = useFeatureTypeContext();

  // Add a point to the map
  const addPoint = useCallback((coordinates: Coordinate, properties: GeoJsonProperties = {}) => {
    const props = properties || {};
    const featureType = props.featureType || {};
    
    const pointFeature: Feature<Point> = {
      type: 'Feature',
      id: properties?.client_id,
      geometry: {
        type: 'Point',
        coordinates
      },
      properties: {
        ...props,
        color: props.color || featureType.color || '#000000',
        style: {
          ...(props.style || {}),
          circleColor: props.color || featureType.color || '#000000',
          circleStrokeColor: props.color || featureType.color || '#000000',
          circleRadius: props.style?.circleRadius || 6,
          circleOpacity: props.style?.circleOpacity || 1,
          circleStrokeWidth: props.style?.circleStrokeWidth || 2,
          circleStrokeOpacity: props.style?.circleStrokeOpacity || 1
        }
      }
    };
    
    // Update visible layers if this is a new layer
    if (props.draw_layer && !state.visibleLayers[props.draw_layer]) {
      dispatch({ 
        type: 'SET_VISIBLE_LAYERS', 
        payload: { ...state.visibleLayers, [props.draw_layer]: true } 
      });
    }
    
    dispatch({ type: 'ADD_FEATURE', payload: pointFeature });
    return properties?.client_id;
  }, [state.visibleLayers]);

  // Update an existing feature
  const updateFeature = useCallback((id: string, coordinates: Coordinate | Coordinate[]) => {
    const featureToUpdate = state.features.features.find(feature => feature.id === id);
    if (!featureToUpdate) {
      console.warn(`Feature with id ${id} not found`);
      dispatch({ type: 'SET_ERROR', payload: `Feature with id ${id} not found` });
      return;
    }
    
    // Since we only support points now, ensure we're using point coordinates
    const pointCoordinates = Array.isArray(coordinates[0]) ? coordinates[0] : coordinates;
    
    const updatedFeature: Feature = {
      ...featureToUpdate,
      geometry: {
        type: 'Point',
        coordinates: pointCoordinates
      } as Point
    };
    
    dispatch({ type: 'UPDATE_FEATURE', payload: { id, feature: updatedFeature } });
  }, [state.features.features]);

  // Remove a feature
  const removeFeature = useCallback((id: string) => {
    // Find the feature being removed to check its layer
    const featureToRemove = state.features.features.find(f => f.id === id);
    const layerToCheck = featureToRemove?.properties?.draw_layer;

    // Remove the feature
    dispatch({ type: 'REMOVE_FEATURE', payload: id });

    // If the feature had a layer, check if it was the last one
    if (layerToCheck) {
      const remainingFeaturesInLayer = state.features.features.filter(
        f => f.properties?.draw_layer === layerToCheck && f.id !== id
      );

      // If this was the last feature in the layer, remove the layer from visibleLayers
      if (remainingFeaturesInLayer.length === 0) {
        const newVisibleLayers = { ...state.visibleLayers };
        delete newVisibleLayers[layerToCheck];
        dispatch({ type: 'SET_VISIBLE_LAYERS', payload: newVisibleLayers });
      }
    }
  }, [state.features.features, state.visibleLayers]);

  // Clear all features
  const clearFeatures = useCallback(() => {
    dispatch({ type: 'CLEAR_FEATURES' });
  }, []);

  // Render any type of feature
  const renderFeature = useCallback((feature: FeatureToRender) => {
    if (feature.type === 'Point') {
      const id = addPoint(feature.coordinates as Coordinate, {
        ...feature.properties,
        draw_layer: feature.properties?.draw_layer
      });
      return id;
    }
    console.warn(`Unsupported feature type: ${feature.type}`);
    dispatch({ type: 'SET_ERROR', payload: `Unsupported feature type: ${feature.type}` });
    return null;
  }, [addPoint]);

  // Preview a feature
  const previewFeature = useCallback((
    coordinates: Coordinate | Coordinate[], 
    type: FeatureType
  ) => {
    const previewProps = { isPreview: true, previewStyle: true };
    
    if (type === 'point') {
      return addPoint(coordinates as Coordinate, previewProps);
    }
    
    console.warn(`Unsupported preview type: ${type}`);
    dispatch({ type: 'SET_ERROR', payload: `Unsupported preview type: ${type}` });
    return null;
  }, [addPoint]);

  const syncFeatures = useCallback(async () => {
    if (!activeProject) {
      dispatch({ type: 'SET_ERROR', payload: 'No active project selected' });
      return;
    }

    try {
      dispatch({ type: 'SET_SYNC_STATUS', payload: { isSyncing: true, lastSyncTime: null } });
      
      const result = await syncService.syncProject(activeProject.id);
      
      if (result.success) {
        // Update last sync time
        dispatch({ 
          type: 'SET_SYNC_STATUS', 
          payload: { 
            isSyncing: false, 
            lastSyncTime: new Date().toISOString() 
          } 
        });
        
        // Clear any existing error
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Clear existing features
        dispatch({ type: 'CLEAR_FEATURES' });
        
        // Load features from storage
        const projectFeatures = await featureStorageService.getFeaturesForProject(activeProject.id);
        
        // Track unique layers to update visibility state
        const uniqueLayers = new Set<string>();
        
        // Add each feature to the map
        for (const feature of projectFeatures) {
          if (!feature.points || feature.points.length === 0) {
            console.warn('Feature has no points:', feature.client_id);
            continue;
          }

          const point = feature.points[0];
          if (!point.attributes?.nmeaData?.gga?.longitude || !point.attributes?.nmeaData?.gga?.latitude) {
            console.warn('Feature has invalid coordinates:', feature.client_id);
            continue;
          }
          
          const longitude = point.attributes.nmeaData.gga.longitude;
          const latitude = point.attributes.nmeaData.gga.latitude;
          
          // Find the feature type by name
          const featureTypeName = feature.name;
          console.log('Looking for feature type by name:', featureTypeName);
          const featureType = getFeatureTypeByName(featureTypeName);
          
          if (!featureType) {
            console.warn(`Feature type "${featureTypeName}" not found in available types:`, featureTypes.map(f => f.name));
            continue;
          }
          
          // Track the layer
          if (feature.draw_layer) {
            uniqueLayers.add(feature.draw_layer);
          }
          
          // Create a feature for the map
          const mapFeature: Feature = {
            type: 'Feature',
            id: feature.client_id,
            geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            properties: {
              type: 'Point',
              client_id: feature.client_id,
              name: feature.name,
              description: point?.description || '',
              feature_id: point?.feature_id || 0,
              featureType: featureType,
              draw_layer: feature.draw_layer,
              style: feature.attributes?.style || {},
              color: featureType.color
            }
          };
          
          // Add to map
          dispatch({ type: 'ADD_FEATURE', payload: mapFeature });
        }

        // Update visible layers for any new layers found
        if (uniqueLayers.size > 0) {
          const newVisibleLayers = { ...state.visibleLayers };
          let needsUpdate = false;
          
          for (const layer of uniqueLayers) {
            if (newVisibleLayers[layer] === undefined) {
              newVisibleLayers[layer] = true;
              needsUpdate = true;
            }
          }
          
          if (needsUpdate) {
            dispatch({ type: 'SET_VISIBLE_LAYERS', payload: newVisibleLayers });
          }
        }
      }
    } catch (error) {
      console.error('Error syncing features:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to sync features' });
    } finally {
      dispatch({ type: 'SET_SYNC_STATUS', payload: { isSyncing: false, lastSyncTime: null } });
    }
  }, [activeProject, dispatch, featureTypes, getFeatureTypeByName, state.visibleLayers]);

  const syncAllProjects = useCallback(async () => {
    try {
      dispatch({ type: 'SET_SYNC_STATUS', payload: { isSyncing: true, lastSyncTime: null } });
      
      const result = await syncService.syncProject(activeProject?.id || 0);
      
      if (result.success) {
        // Update last sync time
        dispatch({ 
          type: 'SET_SYNC_STATUS', 
          payload: { 
            isSyncing: false, 
            lastSyncTime: new Date().toISOString() 
          } 
        });
        
        // Clear any existing error
        dispatch({ type: 'SET_ERROR', payload: null });
      } else {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: result.errorMessage || 'Sync failed' 
        });
        dispatch({ 
          type: 'SET_SYNC_STATUS', 
          payload: { isSyncing: false, lastSyncTime: null } 
        });
      }
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Unknown error during sync' 
      });
      dispatch({ 
        type: 'SET_SYNC_STATUS', 
        payload: { isSyncing: false, lastSyncTime: null } 
      });
    }
  }, [activeProject?.id]);

  const setIsMapReady = (isReady: boolean) => dispatch({ type: 'SET_MAP_READY', payload: isReady });
  const addFeature = useCallback((feature: Feature) => {
    // Update visible layers if this is a new layer
    const drawLayer = feature.properties?.draw_layer;
    if (drawLayer && !state.visibleLayers[drawLayer]) {
      dispatch({ 
        type: 'SET_VISIBLE_LAYERS', 
        payload: { ...state.visibleLayers, [drawLayer]: true } 
      });
    }
    
    dispatch({ type: 'ADD_FEATURE', payload: feature });
  }, [state.visibleLayers]);
  const setError = (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error });

  const setVisibleLayers = useCallback((layers: Record<string, boolean>) => {
    dispatch({ type: 'SET_VISIBLE_LAYERS', payload: layers });
  }, []);

  const toggleLayer = useCallback((layer: string) => {
    dispatch({ type: 'TOGGLE_LAYER', payload: layer });
  }, []);

  return (
    <MapContext.Provider value={{
      features: state.features,
      isMapReady: state.isMapReady,
      setIsMapReady,
      addFeature,
      updateFeature,
      removeFeature,
      clearFeatures,
      isSyncing: state.isSyncing,
      lastSyncTime: state.lastSyncTime,
      error: state.error,
      setError,
      syncFeatures,
      syncAllProjects,
      addPoint,
      renderFeature,
      previewFeature,
      visibleLayers: state.visibleLayers,
      setVisibleLayers,
      toggleLayer
    }}>
      {children}
    </MapContext.Provider>
  );
};

export default MapProvider;