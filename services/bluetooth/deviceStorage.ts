import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothDevice } from 'react-native-bluetooth-classic';

const LAST_DEVICE_KEY = '@bluetooth_last_device';

export const deviceStorage = {
  async storeLastConnectedDevice(device: BluetoothDevice): Promise<void> {
    try {
      const deviceData = {
        address: device.address,
        name: device.name,
        lastConnected: new Date().toISOString()
      };
      await AsyncStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(deviceData));
    } catch (error) {
      console.error('Error storing last connected device:', error);
    }
  },

  async getLastConnectedDevice(): Promise<BluetoothDevice | null> {
    try {
      const deviceJson = await AsyncStorage.getItem(LAST_DEVICE_KEY);
      return deviceJson ? JSON.parse(deviceJson) : null;
    } catch (error) {
      console.error('Error getting last connected device:', error);
      return null;
    }
  },

  async clearLastConnectedDevice(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_DEVICE_KEY);
    } catch (error) {
      console.error('Error clearing last connected device:', error);
    }
  }
};