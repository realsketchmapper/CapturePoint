import { useState, useCallback } from 'react';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import { useBluetoothContext } from '@/contexts/BluetoothContext';
import { BluetoothDeviceType } from '@/types/bluetooth.types';

/**
 * Custom hook for managing Bluetooth device selection and connection
 * Provides state and handlers for device type and device selection modals
 * @returns Object containing state and handlers for Bluetooth device management
 */
export const useBluetooth = () => {
  // Modal visibility states
  const [isDeviceTypeModalVisible, setIsDeviceTypeModalVisible] = useState(false);
  const [isDeviceSelectionModalVisible, setIsDeviceSelectionModalVisible] = useState(false);
  
  // Device states
  const [selectedDeviceType, setSelectedDeviceType] = useState<BluetoothDeviceType | null>(null);
  
  // Get Bluetooth state and functions from context
  const { 
    connectedDevice,
    isScanning,
    isConnecting,
    isDisconnecting,
    error,
    connectionError,
    isBluetoothEnabled,
    connectToDevice,
    scanDevices,
    disconnectFromDevice,
    clearErrors
  } = useBluetoothContext();

  /**
   * Handles the Bluetooth button press
   * Shows the device type selection modal
   */
  const handleBluetoothPress = useCallback(() => {
    setIsDeviceTypeModalVisible(true);
  }, []);

  /**
   * Handles device type selection
   * @param deviceType - The selected device type
   */
  const handleDeviceTypeSelection = useCallback((deviceType: BluetoothDeviceType) => {
    setSelectedDeviceType(deviceType);
    setIsDeviceTypeModalVisible(false);
    setIsDeviceSelectionModalVisible(true);
  }, []);

  /**
   * Handles device selection and connection
   * @param device - The selected Bluetooth device
   * @returns Promise resolving to boolean indicating connection success
   */
  const handleDeviceSelection = useCallback(async (device: BluetoothDevice): Promise<boolean> => {
    const success = await connectToDevice(device);
    if (success) {
      setIsDeviceSelectionModalVisible(false);
    }
    return success;
  }, [connectToDevice]);

  /**
   * Handles closing the device type modal
   */
  const handleCloseDeviceTypeModal = useCallback(() => {
    setIsDeviceTypeModalVisible(false);
  }, []);

  /**
   * Handles closing the device selection modal
   */
  const handleCloseDeviceSelectionModal = useCallback(() => {
    setIsDeviceSelectionModalVisible(false);
  }, []);

  const isConnectedToRTKPro = useCallback((): boolean => {
    if (!connectedDevice) return false;
    
    // Check if the connected device is an RTK-Pro device
    // RTK-Pro devices have names that start with 'vLoc3-RTK-Pro'
    const isRTKPro = connectedDevice.name?.startsWith('vLoc3-RTK-Pro') || false;
    return isRTKPro;
  }, [connectedDevice]);

  return {
    // Modal visibility states
    isDeviceTypeModalVisible,
    isDeviceSelectionModalVisible,
    
    // Device states from context
    selectedDeviceType,
    connectedDevice,
    isScanning,
    isConnecting,
    isDisconnecting,
    error,
    connectionError,
    isBluetoothEnabled,
    
    // Event handlers
    handleBluetoothPress,
    handleDeviceTypeSelection,
    handleDeviceSelection,
    handleCloseDeviceTypeModal,
    handleCloseDeviceSelectionModal,
    isConnectedToRTKPro,
    
    // Context functions
    scanDevices,
    disconnectFromDevice,
    clearErrors,
  };
}; 