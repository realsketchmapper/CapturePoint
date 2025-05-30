import React, { createContext, useContext, useState, useCallback } from 'react';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import { BluetoothContextType, BluetoothDeviceType } from '@/types/bluetooth.types';
import { BluetoothManager } from '@/services/bluetooth/bluetoothManager';
import { useNMEAContext } from './NMEAContext';
import { useLocationContext } from './LocationContext';

const BluetoothContext = createContext<BluetoothContextType | null>(null);

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { startListening, stopListening } = useNMEAContext();
  const { setUsingNMEA } = useLocationContext();

  const scanDevices = useCallback(async (deviceType: BluetoothDeviceType) => {
    try {
      setIsScanning(true);
      setError(null);
      
      const devices = await BluetoothManager.scanDevices(deviceType);
      
      if (devices.length === 0) {
        setError(`No paired ${deviceType} devices found. Please pair your device in system settings.`);
      }

      return devices;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan devices';
      setError(errorMessage);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  const connectToDevice = useCallback(async (device: BluetoothDevice) => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      const connected = await BluetoothManager.connectToDevice(device);
      
      if (connected) {
        await startListening(device.address);
        setUsingNMEA(true);
      }

      return connected;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to connect to device. Please try again.';
      setConnectionError(errorMessage);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [startListening, setUsingNMEA]);

  const disconnectDevice = useCallback(async (address: string) => {
    try {
      await stopListening(address);
      await BluetoothManager.disconnectDevice(address);
      setUsingNMEA(false);
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  }, [stopListening, setUsingNMEA]);

  const clearErrors = useCallback(() => {
    setError(null);
    setConnectionError(null);
  }, []);

  const value: BluetoothContextType = {
    isScanning,
    isConnecting,
    error,
    connectionError,
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

