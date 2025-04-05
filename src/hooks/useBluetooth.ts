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
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  
  // Get connectToDevice function from context
  const { connectToDevice } = useBluetoothContext();

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
      setConnectedDevice(device);
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

  return {
    // Modal visibility states
    isDeviceTypeModalVisible,
    isDeviceSelectionModalVisible,
    
    // Device states
    selectedDeviceType,
    connectedDevice,
    
    // Event handlers
    handleBluetoothPress,
    handleDeviceTypeSelection,
    handleDeviceSelection,
    handleCloseDeviceTypeModal,
    handleCloseDeviceSelectionModal
  };
}; 