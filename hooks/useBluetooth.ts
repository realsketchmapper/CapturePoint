import { useState, useCallback } from 'react';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import { useBluetoothContext } from '@/contexts/BluetoothContext';
import { BluetoothDeviceType } from '@/types/bluetooth.types';

export const useBluetooth = () => {
  const [isDeviceTypeModalVisible, setIsDeviceTypeModalVisible] = useState(false);
  const [isDeviceSelectionModalVisible, setIsDeviceSelectionModalVisible] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<BluetoothDeviceType | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  
  const { connectToDevice } = useBluetoothContext();

  const handleBluetoothPress = () => {
    setIsDeviceTypeModalVisible(true);
  };

  const handleDeviceTypeSelection = (deviceType: BluetoothDeviceType) => {
    setSelectedDeviceType(deviceType);
    setIsDeviceTypeModalVisible(false);
    setIsDeviceSelectionModalVisible(true);
  };

  const handleDeviceSelection = useCallback(async (device: BluetoothDevice) => {
    const success = await connectToDevice(device);
    if (success) {
      setConnectedDevice(device);
      setIsDeviceSelectionModalVisible(false);
    }
    return success;
  }, [connectToDevice]);

  const handleCloseDeviceTypeModal = () => {
    setIsDeviceTypeModalVisible(false);
  };

  const handleCloseDeviceSelectionModal = () => {
    setIsDeviceSelectionModalVisible(false);
  };

  return {
    isDeviceTypeModalVisible,
    isDeviceSelectionModalVisible,
    selectedDeviceType,
    connectedDevice,
    handleBluetoothPress,
    handleDeviceTypeSelection,
    handleDeviceSelection,
    handleCloseDeviceTypeModal,
    handleCloseDeviceSelectionModal
  };
};