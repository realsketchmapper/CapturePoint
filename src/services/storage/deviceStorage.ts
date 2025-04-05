import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothDevice } from 'react-native-bluetooth-classic';

const LAST_DEVICE_KEY = '@bluetooth_last_device';

// Interface for stored device data
interface StoredDeviceData {
  address: string;
  name: string;
  lastConnected: string;
}

export class DeviceStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceStorageError';
  }
}

export const deviceStorage = {
  /**
   * Store the last connected device
   */
  async storeLastConnectedDevice(device: BluetoothDevice): Promise<void> {
    try {
      const deviceData: StoredDeviceData = {
        address: device.address,
        name: device.name,
        lastConnected: new Date().toISOString()
      };
      await AsyncStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(deviceData));
    } catch (error: any) {
      console.error('Error storing last connected device:', error);
      throw new DeviceStorageError(`Failed to store device: ${error?.message || 'Unknown error'}`);
    }
  },

  /**
   * Get the last connected device
   */
  async getLastConnectedDevice(): Promise<BluetoothDevice | null> {
    try {
      const deviceJson = await AsyncStorage.getItem(LAST_DEVICE_KEY);
      if (!deviceJson) return null;
      
      const deviceData: StoredDeviceData = JSON.parse(deviceJson);
      
      // Check if the stored data is still valid (less than 24 hours old)
      const lastConnected = new Date(deviceData.lastConnected);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastConnected.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        // Data is too old, clear it
        await this.clearLastConnectedDevice();
        return null;
      }
      
      return {
        address: deviceData.address,
        name: deviceData.name
      } as BluetoothDevice;
    } catch (error: any) {
      console.error('Error getting last connected device:', error);
      // If there's an error parsing the data, clear it
      await this.clearLastConnectedDevice();
      return null;
    }
  },

  /**
   * Clear the last connected device
   */
  async clearLastConnectedDevice(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_DEVICE_KEY);
    } catch (error: any) {
      console.error('Error clearing last connected device:', error);
      throw new DeviceStorageError(`Failed to clear device: ${error?.message || 'Unknown error'}`);
    }
  }
}; 