import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { BluetoothDevice, BluetoothEventSubscription } from 'react-native-bluetooth-classic';
import { BluetoothContextType, BluetoothDeviceType, BluetoothState, BluetoothActions } from '@/types/bluetooth.types';
import { BluetoothManager } from '@/services/bluetooth/bluetoothManager';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { useLocationContext } from '@/contexts/LocationContext';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

const BluetoothContext = createContext<BluetoothContextType | null>(null);

// Define action types
type BluetoothAction = 
  | { type: 'SET_SCANNING'; payload: boolean }
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTION_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTED_DEVICE'; payload: BluetoothDevice | null }
  | { type: 'SET_BLUETOOTH_ENABLED'; payload: boolean }
  | { type: 'CLEAR_ERRORS' };

// Define initial state
const initialState: BluetoothState = {
  isScanning: false,
  isConnecting: false,
  error: null,
  connectionError: null,
  connectedDevice: null,
  isBluetoothEnabled: false
};

// Reducer function
function bluetoothReducer(state: BluetoothState, action: BluetoothAction): BluetoothState {
  switch (action.type) {
    case 'SET_SCANNING':
      return { ...state, isScanning: action.payload };
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CONNECTION_ERROR':
      return { ...state, connectionError: action.payload };
    case 'SET_CONNECTED_DEVICE':
      return { ...state, connectedDevice: action.payload };
    case 'SET_BLUETOOTH_ENABLED':
      return { ...state, isBluetoothEnabled: action.payload };
    case 'CLEAR_ERRORS':
      return { ...state, error: null, connectionError: null };
    default:
      return state;
  }
}

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);
  const { startListening, stopListening } = useNMEAContext();
  const { setUsingNMEA } = useLocationContext();
  const bluetoothStateListener = useRef<any>(null);
  const bluetoothManager = BluetoothManager.getInstance();

  // Monitor Bluetooth state changes
  useEffect(() => {
    const checkBluetoothState = async () => {
      try {
        const isEnabled = await bluetoothManager.isBluetoothEnabled();
        dispatch({ type: 'SET_BLUETOOTH_ENABLED', payload: isEnabled });
      } catch (error) {
        console.error('Error checking Bluetooth state:', error);
      }
    };

    // Check initial state
    checkBluetoothState();

    // Set up listener for Bluetooth state changes
    const subscription = RNBluetoothClassic.onStateChanged((event) => {
      dispatch({ type: 'SET_BLUETOOTH_ENABLED', payload: event.state === 'on' });
    }) as BluetoothEventSubscription;

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const scanDevices = useCallback(async (deviceType: BluetoothDeviceType) => {
    try {
      dispatch({ type: 'SET_SCANNING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const devices = await bluetoothManager.scanDevices(deviceType);
      
      if (devices.length === 0) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: `No paired ${deviceType} devices found. Please pair your device in system settings.` 
        });
      }

      return devices;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan devices';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return [];
    } finally {
      dispatch({ type: 'SET_SCANNING', payload: false });
    }
  }, []);

  const connectToDevice = useCallback(async (device: BluetoothDevice) => {
    try {
      dispatch({ type: 'SET_CONNECTING', payload: true });
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: null });

      const connected = await bluetoothManager.connectToDevice(device);
      
      if (connected) {
        await startListening(device.address);
        setUsingNMEA(true);
        dispatch({ type: 'SET_CONNECTED_DEVICE', payload: device });
      }

      return connected;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to connect to device. Please try again.';
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: errorMessage });
      return false;
    } finally {
      dispatch({ type: 'SET_CONNECTING', payload: false });
    }
  }, [startListening, setUsingNMEA]);

  const disconnectDevice = useCallback(async (address: string) => {
    try {
      await stopListening(address);
      await bluetoothManager.disconnectDevice(address);
      setUsingNMEA(false);
      dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
    } catch (err) {
      console.error('Error disconnecting:', err);
      // Still clear the connected device even if there's an error
      dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
    }
  }, [stopListening, setUsingNMEA]);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  const value: BluetoothContextType = {
    ...state,
    scanDevices,
    connectToDevice,
    disconnectDevice,
    clearErrors
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetoothContext = () => {
  const context = useContext(BluetoothContext);
  if (context === null) {
    throw new Error('useBluetoothContext must be used within a BluetoothProvider');
  }
  return context;
};

