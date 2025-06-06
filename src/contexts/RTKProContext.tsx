import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { RTKProData, RTKProLocateData, RTKProGPSData } from '@/types/nmea.types';
import { NMEAParser } from '@/services/gnss/nmeaParser';

interface RTKProState {
  currentLocateData: RTKProLocateData | null;
  currentGPSData: RTKProGPSData | null;
  lastButtonPressTime: string | null;
  isReceivingData: boolean;
  error: string | null;
}

interface RTKProContextType {
  currentLocateData: RTKProLocateData | null;
  currentGPSData: RTKProGPSData | null;
  lastButtonPressTime: string | null;
  isReceivingData: boolean;
  error: string | null;
  handleRTKProData: (data: string) => void;
  clearData: () => void;
  getMaplibreCoordinates: () => [number, number] | null;
  getMySQLPoint: () => { longitude: number; latitude: number } | null;
}

type RTKProAction = 
  | { type: 'SET_LOCATE_DATA'; payload: RTKProLocateData }
  | { type: 'SET_GPS_DATA'; payload: RTKProGPSData }
  | { type: 'SET_RECEIVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_DATA' };

const initialState: RTKProState = {
  currentLocateData: null,
  currentGPSData: null,
  lastButtonPressTime: null,
  isReceivingData: false,
  error: null
};

function rtkProReducer(state: RTKProState, action: RTKProAction): RTKProState {
  switch (action.type) {
    case 'SET_LOCATE_DATA':
      return {
        ...state,
        currentLocateData: action.payload,
        lastButtonPressTime: new Date().toISOString(),
        error: null
      };
    case 'SET_GPS_DATA':
      return {
        ...state,
        currentGPSData: action.payload,
        lastButtonPressTime: new Date().toISOString(),
        error: null
      };
    case 'SET_RECEIVING':
      return {
        ...state,
        isReceivingData: action.payload
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
    case 'CLEAR_DATA':
      return initialState;
    default:
      return state;
  }
}

const RTKProContext = createContext<RTKProContextType | undefined>(undefined);

interface RTKProProviderProps {
  children: ReactNode;
}

export const RTKProProvider: React.FC<RTKProProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(rtkProReducer, initialState);

  const handleRTKProData = useCallback((data: string) => {
    try {
      dispatch({ type: 'SET_RECEIVING', payload: true });
      
      const parsedData = NMEAParser.parseRTKProData(data);
      
      if (parsedData) {
        if (parsedData.locateData) {
          console.log('🎯 RTK-Pro Locate Data Captured:', parsedData.locateData);
          dispatch({ type: 'SET_LOCATE_DATA', payload: parsedData.locateData });
          console.log('📊 Current state after locate data set:', { 
            currentLocateData: parsedData.locateData,
            currentGPSData: state.currentGPSData,
            lastButtonPressTime: new Date().toISOString()
          });
        }
        
        if (parsedData.gpsData) {
          console.log('🌍 RTK-Pro GPS Data Captured:', parsedData.gpsData);
          dispatch({ type: 'SET_GPS_DATA', payload: parsedData.gpsData });
          console.log('📊 Current state after GPS data set:', { 
            currentLocateData: state.currentLocateData,
            currentGPSData: parsedData.gpsData,
            lastButtonPressTime: new Date().toISOString()
          });
        }
      }
      
      dispatch({ type: 'SET_RECEIVING', payload: false });
    } catch (error) {
      console.error('Error handling RTK-Pro data:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
      dispatch({ type: 'SET_RECEIVING', payload: false });
    }
  }, []);

  // Register the handler globally so Bluetooth manager can access it
  React.useEffect(() => {
    (global as any).rtkProDataHandler = handleRTKProData;
    
    return () => {
      (global as any).rtkProDataHandler = null;
    };
  }, [handleRTKProData]);

  const clearData = useCallback(() => {
    dispatch({ type: 'CLEAR_DATA' });
  }, []);

  const getMaplibreCoordinates = useCallback((): [number, number] | null => {
    if (state.currentGPSData) {
      return NMEAParser.rtkProGpsToMaplibreCoordinates(state.currentGPSData);
    }
    return null;
  }, [state.currentGPSData]);

  const getMySQLPoint = useCallback((): { longitude: number; latitude: number } | null => {
    if (state.currentGPSData) {
      return {
        longitude: state.currentGPSData.longitude,
        latitude: state.currentGPSData.latitude
      };
    }
    return null;
  }, [state.currentGPSData]);

  const contextValue: RTKProContextType = {
    currentLocateData: state.currentLocateData,
    currentGPSData: state.currentGPSData,
    lastButtonPressTime: state.lastButtonPressTime,
    isReceivingData: state.isReceivingData,
    error: state.error,
    handleRTKProData,
    clearData,
    getMaplibreCoordinates,
    getMySQLPoint
  };

  return (
    <RTKProContext.Provider value={contextValue}>
      {children}
    </RTKProContext.Provider>
  );
};

export const useRTKPro = (): RTKProContextType => {
  const context = useContext(RTKProContext);
  if (context === undefined) {
    throw new Error('useRTKPro must be used within an RTKProProvider');
  }
  
  // Debug logging to see what values are being returned
  React.useEffect(() => {
    console.log('🔍 useRTKPro values changed:', {
      currentLocateData: context.currentLocateData,
      currentGPSData: context.currentGPSData,
      lastButtonPressTime: context.lastButtonPressTime
    });
  }, [context.currentLocateData, context.currentGPSData, context.lastButtonPressTime]);
  
  return context;
}; 