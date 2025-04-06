import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothDevice } from 'react-native-bluetooth-classic';

/**
 * Storage key for the last connected Bluetooth device
 */
const LAST_DEVICE_KEY = '@bluetooth_last_device';

/**
 * Interface for stored device data
 * Contains only the essential properties needed for device reconnection
 */
interface StoredDeviceData {
  address: string;
  name: string;
  lastConnected: string;
}

/**
 * Custom error class for device storage operations
 * Provides more specific error information for debugging
 */
export class DeviceStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceStorageError';
  }
}

/**
 * Service for managing Bluetooth device storage
 * Handles storing and retrieving the last connected device
 * 
 * Performance considerations:
 * - Minimal storage operations to reduce overhead
 * - Automatic expiration of old device data (24 hours)
 * - Retry mechanism for critical operations
 */
export const deviceStorage = {
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second

  /**
   * Store the last connected device
   * @param device - The Bluetooth device to store
   * @throws DeviceStorageError if storage operation fails after retries
   */
  async storeLastConnectedDevice(device: BluetoothDevice): Promise<void> {
    return this._withRetry(async () => {
      const deviceData: StoredDeviceData = {
        address: device.address,
        name: device.name,
        lastConnected: new Date().toISOString()
      };
      await AsyncStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(deviceData));
    }, 'storing last connected device');
  },

  /**
   * Get the last connected device
   * Returns null if no device is stored or if the stored data is expired (>24 hours old)
   * @returns The last connected Bluetooth device or null if not available
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
      
      // Create a minimal BluetoothDevice object with only the necessary properties
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
   * @throws DeviceStorageError if clearing operation fails after retries
   */
  async clearLastConnectedDevice(): Promise<void> {
    return this._withRetry(async () => {
      await AsyncStorage.removeItem(LAST_DEVICE_KEY);
    }, 'clearing last connected device');
  },

  /**
   * Executes an operation with retry logic
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for error messages
   * @private
   */
  async _withRetry(
    operation: () => Promise<void>,
    operationName: string
  ): Promise<void> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed for ${operationName}:`, error);
        
        if (attempt < this.MAX_RETRIES) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    // All retries failed
    throw new DeviceStorageError(`Failed to ${operationName} after ${this.MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
  }
}; 