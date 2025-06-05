import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { BluetoothDevice, BluetoothEventSubscription } from 'react-native-bluetooth-classic';
import { BluetoothContextType, BluetoothDeviceType, BluetoothState, BluetoothActions, BluetoothConnectionEventData } from '@/types/bluetooth.types';
import { BluetoothManager } from '@/services/bluetooth/bluetoothManager';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { useLocationContext } from '@/contexts/LocationContext';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { deviceStorage } from '@/services/storage/deviceStorage';
import { syncService } from '@/services/sync/syncService';
import { useProjectContext } from './ProjectContext';
import { BluetoothDisconnectionModal } from '@/components/modals/BluetoothModals/BluetoothDisconnectionModal';

const BluetoothContext = createContext<BluetoothContextType | null>(null);

// Define action types
type BluetoothAction = 
  | { type: 'SET_SCANNING'; payload: boolean }
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_DISCONNECTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTION_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTED_DEVICE'; payload: BluetoothDevice | null }
  | { type: 'SET_BLUETOOTH_ENABLED'; payload: boolean }
  | { type: 'SET_CONNECTION_EVENT'; payload: BluetoothConnectionEventData | null }
  | { type: 'CLEAR_ERRORS' };

// Define initial state
const initialState: BluetoothState = {
  isScanning: false,
  isConnecting: false,
  isDisconnecting: false,
  error: null,
  connectionError: null,
  connectedDevice: null,
  isBluetoothEnabled: false,
  lastConnectionEvent: null,
};

// Reducer function
function bluetoothReducer(state: BluetoothState, action: BluetoothAction): BluetoothState {
  switch (action.type) {
    case 'SET_SCANNING':
      return { ...state, isScanning: action.payload };
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload };
    case 'SET_DISCONNECTING':
      return { ...state, isDisconnecting: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CONNECTION_ERROR':
      return { ...state, connectionError: action.payload };
    case 'SET_CONNECTED_DEVICE':
      return { ...state, connectedDevice: action.payload };
    case 'SET_BLUETOOTH_ENABLED':
      return { ...state, isBluetoothEnabled: action.payload };
    case 'SET_CONNECTION_EVENT':
      return { ...state, lastConnectionEvent: action.payload };
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
  const { activeProject } = useProjectContext();
  
  // Add state for disconnection modal
  const [isDisconnectionModalVisible, setIsDisconnectionModalVisible] = useState(false);
  const [disconnectedDevice, setDisconnectedDevice] = useState<BluetoothDevice | null>(null);
  const [disconnectionReason, setDisconnectionReason] = useState<string | undefined>(undefined);

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

  // Add connection event monitoring
  useEffect(() => {
    const handleConnectionEvent = (eventData: BluetoothConnectionEventData) => {
      dispatch({ type: 'SET_CONNECTION_EVENT', payload: eventData });
      
      if (eventData.event === 'disconnected') {
        console.log(`📱 Handling disconnection event in BluetoothContext for ${eventData.device.name}`);
        
        // Update connected device state immediately
        dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
        
        // Stop NMEA listening and switch back to device location
        stopListening(eventData.device.address);
        setUsingNMEA(false);
        
        // Show disconnection modal
        setDisconnectedDevice(eventData.device);
        setDisconnectionReason(eventData.reason);
        setIsDisconnectionModalVisible(true);
      }
    };

    bluetoothManager.addConnectionEventListener(handleConnectionEvent);

    return () => {
      bluetoothManager.removeConnectionEventListener(handleConnectionEvent);
    };
  }, [stopListening, setUsingNMEA]);

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
      console.log(`🚀 BluetoothContext: Starting connection to ${device.name} (${device.address})`);
      dispatch({ type: 'SET_CONNECTING', payload: true });
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: null });

      // Check if already connected
      console.log('🔍 BluetoothContext: Checking if already connected...');
      const isConnected = await bluetoothManager.isBluetoothEnabled() && 
                         await RNBluetoothClassic.isDeviceConnected(device.address);
      
      console.log(`📋 BluetoothContext: Already connected check: ${isConnected}`);
      
      if (isConnected) {
        console.log('✅ BluetoothContext: Device already connected, starting listening...');
        dispatch({ type: 'SET_CONNECTED_DEVICE', payload: device });
        await startListening(device.address);
        setUsingNMEA(true);
        console.log('✅ BluetoothContext: Connection process completed (already connected)');
        return true;
      }

      console.log('🔌 BluetoothContext: Attempting new connection...');
      const connected = await bluetoothManager.connectToDevice(device);
      
      console.log(`📊 BluetoothContext: Connection result: ${connected}`);
      
      if (connected) {
        console.log('✅ BluetoothContext: Connection successful, starting listening...');
        await startListening(device.address);
        setUsingNMEA(true);
        dispatch({ type: 'SET_CONNECTED_DEVICE', payload: device });
        console.log('✅ BluetoothContext: Full connection process completed');
      } else {
        console.log('❌ BluetoothContext: Connection failed');
      }

      return connected;
    } catch (err) {
      console.error('❌ BluetoothContext: Error in connectToDevice:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to connect to device. Please try again.';
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: errorMessage });
      return false;
    } finally {
      console.log('🏁 BluetoothContext: Setting connecting to false');
      dispatch({ type: 'SET_CONNECTING', payload: false });
    }
  }, [startListening, setUsingNMEA]);

  const connectToLastDevice = useCallback(async () => {
    try {
      dispatch({ type: 'SET_CONNECTING', payload: true });
      
      const lastDevice = await deviceStorage.getLastConnectedDevice();
      if (!lastDevice) {
        dispatch({ type: 'SET_ERROR', payload: 'No last connected device found' });
        return;
      }
      
      await connectToDevice(lastDevice);
    } catch (error) {
      console.error('Error connecting to last device:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to connect to last device' });
    } finally {
      dispatch({ type: 'SET_CONNECTING', payload: false });
    }
  }, [connectToDevice]);

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

  const disconnectFromDevice = useCallback(async () => {
    try {
      dispatch({ type: 'SET_DISCONNECTING', payload: true });
      
      if (!state.connectedDevice) {
        dispatch({ type: 'SET_ERROR', payload: 'No device connected' });
        return;
      }
      
      await state.connectedDevice.disconnect();
      await deviceStorage.clearLastConnectedDevice();
      
      dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      console.error('Error disconnecting from device:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to disconnect from device' });
    } finally {
      dispatch({ type: 'SET_DISCONNECTING', payload: false });
    }
  }, [state.connectedDevice]);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  const handleReconnectDevice = useCallback(async () => {
    if (!disconnectedDevice) return;
    
    setIsDisconnectionModalVisible(false);
    
    try {
      console.log(`🔄 Attempting to reconnect to ${disconnectedDevice.name}...`);
      const success = await connectToDevice(disconnectedDevice);
      
      if (success) {
        console.log(`✅ Successfully reconnected to ${disconnectedDevice.name}`);
      } else {
        console.log(`❌ Failed to reconnect to ${disconnectedDevice.name}`);
        dispatch({ type: 'SET_CONNECTION_ERROR', payload: 'Failed to reconnect. Please try manually.' });
      }
    } catch (error) {
      console.error('Error during reconnection:', error);
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: 'Reconnection failed. Please try manually.' });
    } finally {
      setDisconnectedDevice(null);
      setDisconnectionReason(undefined);
    }
  }, [disconnectedDevice, connectToDevice]);

  const handleDismissDisconnectionModal = useCallback(() => {
    setIsDisconnectionModalVisible(false);
    setDisconnectedDevice(null);
    setDisconnectionReason(undefined);
  }, []);

  const value: BluetoothContextType = {
    ...state,
    scanDevices,
    connectToDevice,
    connectToLastDevice,
    disconnectDevice,
    disconnectFromDevice,
    clearErrors
  };

  // Start sync service when a project is active
  useEffect(() => {
    if (activeProject?.id) {
      syncService.start(activeProject.id);
    }
    
    return () => {
      syncService.stop();
    };
  }, [activeProject?.id]);

  return (
    <BluetoothContext.Provider value={value}>
      {children}
      <BluetoothDisconnectionModal
        visible={isDisconnectionModalVisible}
        onClose={handleDismissDisconnectionModal}
        onReconnect={handleReconnectDevice}
        deviceName={disconnectedDevice?.name || 'Unknown Device'}
        reason={disconnectionReason}
      />
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

