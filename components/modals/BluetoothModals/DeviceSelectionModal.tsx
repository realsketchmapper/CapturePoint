import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Platform
} from 'react-native';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import { useBluetoothContext } from '@/contexts/BluetoothContext';
import { Colors } from '@/theme/colors';
import { DeviceSelectionModalProps } from '@/types/bluetooth.types';

export const DeviceSelectionModal: React.FC<DeviceSelectionModalProps> = ({
  isVisible,
  onClose,
  onDeviceSelected,
  deviceType
}) => {
  const {
    scanDevices,
    error,
    isScanning,
    isConnecting,
    connectionError
  } = useBluetoothContext();

  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [localConnectionError, setLocalConnectionError] = useState<string | null>(null);
  const [connectingDevice, setConnectingDevice] = useState<BluetoothDevice | null>(null);

  const handleScanDevices = async () => {
    setLocalConnectionError(null);
    const scannedDevices = await scanDevices(deviceType);
    setDevices(scannedDevices);
  };

  const handleDeviceSelection = async (device: BluetoothDevice) => {
    setLocalConnectionError(null);
    setConnectingDevice(device);
    const success = await onDeviceSelected(device);
    if (!success) {
      setLocalConnectionError(`Unable to connect to ${device.name || 'device'}. Please ensure it is turned on and in range.`);
    }
    setConnectingDevice(null);
  };

  useEffect(() => {
    if (isVisible) {
      handleScanDevices();
    }
  }, [isVisible, deviceType]);

  const displayError = error || localConnectionError || connectionError;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>Select {deviceType}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {displayError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScanDevices}
              disabled={isScanning}
            >
              <Text style={styles.scanButtonText}>
                {isScanning ? 'Scanning...' : 'Scan for Devices'}
              </Text>
            </TouchableOpacity>

            {isScanning && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.loadingText}>Scanning for devices...</Text>
              </View>
            )}

            <ScrollView style={styles.deviceList}>
              {devices.map((device) => (
                <TouchableOpacity
                  key={device.id || device.address}
                  style={styles.deviceItem}
                  onPress={() => handleDeviceSelection(device)}
                  disabled={isConnecting}
                >
                  <Text style={styles.deviceName}>
                    {device.name || 'Unknown Device'}
                  </Text>
                  {connectingDevice?.id === device.id && (
                    <ActivityIndicator size="small" color="white" />
                  )}
                </TouchableOpacity>
              ))}
              
              {!isScanning && devices.length === 0 && (
                <Text style={styles.noDevicesText}>
                  No devices found. Try scanning again.
                </Text>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'black',
    marginTop: Platform.OS === 'android' ? 25 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'white',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white'
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: Colors.Aqua,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: 'white',
  },
  deviceList: {
    flex: 1,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'white',
  },
  deviceName: {
    fontSize: 16,
    color: 'white'
  },
  noDevicesText: {
    textAlign: 'center',
    color: 'white',
    marginTop: 20,
  },
});