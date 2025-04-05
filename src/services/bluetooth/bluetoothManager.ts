import RNBluetoothClassic, { 
  BluetoothDevice, 
  BluetoothEventSubscription 
} from 'react-native-bluetooth-classic';
import { BluetoothDeviceType } from '@/types/bluetooth.types';
import { BLUETOOTH_DEVICE_TYPES } from '@/utils/constants';
import { deviceStorage } from '../storage/deviceStorage';

// Custom error types for better error handling
export class BluetoothError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BluetoothError';
  }
}

export class ConnectionError extends BluetoothError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class DeviceNotFoundError extends BluetoothError {
  constructor(message: string) {
    super(message, 'DEVICE_NOT_FOUND');
    this.name = 'DeviceNotFoundError';
  }
}

// Connection state type
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Device status interface
interface DeviceStatus {
  address: string;
  name: string;
  isConnected: boolean;
  lastSeen: Date;
}

export class BluetoothManager {
  private static instance: BluetoothManager;
  private subscriptions: Map<string, BluetoothEventSubscription> = new Map();
  private deviceStatusCache: Map<string, DeviceStatus> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  private connectionRetryCount = 0;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly CONNECTION_TIMEOUT = 10000; // 10 seconds
  private readonly CACHE_TTL = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): BluetoothManager {
    if (!BluetoothManager.instance) {
      BluetoothManager.instance = new BluetoothManager();
    }
    return BluetoothManager.instance;
  }

  /**
   * Get the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if Bluetooth is enabled
   */
  public async isBluetoothEnabled(): Promise<boolean> {
    return RNBluetoothClassic.isBluetoothEnabled();
  }

  /**
   * Scan for devices of a specific type
   */
  public async scanDevices(deviceType: BluetoothDeviceType): Promise<BluetoothDevice[]> {
    const enabled = await this.isBluetoothEnabled();
    if (!enabled) {
      throw new BluetoothError('Please enable Bluetooth in your device settings', 'BLUETOOTH_DISABLED');
    }

    const devices = await RNBluetoothClassic.getBondedDevices();
    const deviceTypeConfig = BLUETOOTH_DEVICE_TYPES.find(type => type.name === deviceType);
    
    if (!deviceTypeConfig) {
      throw new BluetoothError(`Device type ${deviceType} not found in configuration`, 'INVALID_DEVICE_TYPE');
    }

    // Update device status cache
    devices.forEach(device => {
      if (device.name && device.name.startsWith(deviceTypeConfig.namePrefix)) {
        this.deviceStatusCache.set(device.address, {
          address: device.address,
          name: device.name,
          isConnected: false,
          lastSeen: new Date()
        });
      }
    });

    return devices.filter(device =>
      device.name && device.name.startsWith(deviceTypeConfig.namePrefix)
    );
  }

  /**
   * Connect to a device with retry logic
   */
  public async connectToDevice(device: BluetoothDevice): Promise<boolean> {
    this.connectionState = 'connecting';
    
    // Check cache first
    const cachedStatus = this.deviceStatusCache.get(device.address);
    if (cachedStatus && cachedStatus.isConnected) {
      const isStillConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
      if (isStillConnected) {
        this.connectionState = 'connected';
        return true;
      }
    }

    // Reset retry count for new connection attempt
    this.connectionRetryCount = 0;
    
    while (this.connectionRetryCount < this.MAX_RETRY_COUNT) {
      try {
        await this._attemptConnection(device);
        this.connectionState = 'connected';
        return true;
      } catch (error) {
        this.connectionRetryCount++;
        console.warn(`Connection attempt ${this.connectionRetryCount} failed:`, error);
        
        if (this.connectionRetryCount >= this.MAX_RETRY_COUNT) {
          this.connectionState = 'error';
          throw new ConnectionError(`Failed to connect after ${this.MAX_RETRY_COUNT} attempts`);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, this.connectionRetryCount - 1)));
      }
    }
    
    return false;
  }

  /**
   * Internal method to attempt a single connection
   */
  private async _attemptConnection(device: BluetoothDevice): Promise<void> {
    const isAlreadyConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
    if (isAlreadyConnected) {
      return;
    }

    // Attempt connection with timeout
    await Promise.race([
      RNBluetoothClassic.connectToDevice(device.address),
      new Promise((_, reject) =>
        setTimeout(() => reject(new ConnectionError('Connection timeout')), this.CONNECTION_TIMEOUT)
      )
    ]);

    // Verify connection
    const isConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
    if (!isConnected) {
      throw new ConnectionError('Device connection failed. Please ensure the device is turned on and in range.');
    }

    // Update cache
    this.deviceStatusCache.set(device.address, {
      address: device.address,
      name: device.name,
      isConnected: true,
      lastSeen: new Date()
    });

    // Store the connected device
    await deviceStorage.storeLastConnectedDevice(device);
  }

  /**
   * Start listening to device data
   */
  public async startListeningToDevice(
    address: string,
    onDataReceived: (data: string) => void
  ): Promise<void> {
    // Check cache first
    const cachedStatus = this.deviceStatusCache.get(address);
    if (!cachedStatus || !cachedStatus.isConnected) {
      const isConnected = await RNBluetoothClassic.isDeviceConnected(address);
      if (!isConnected) {
        throw new DeviceNotFoundError('Device is not connected');
      }
      
      // Update cache
      if (cachedStatus) {
        cachedStatus.isConnected = true;
        cachedStatus.lastSeen = new Date();
      }
    }

    // Remove any existing subscription
    await this.stopListeningToDevice(address);

    try {
      // Get the connected device
      const device = await RNBluetoothClassic.getConnectedDevice(address);

      // Subscribe to device data
      const subscription = device.onDataReceived((data) => {
        onDataReceived(data.data);
      });

      // Store the subscription
      this.subscriptions.set(address, subscription);

    } catch (error: any) {
      // Clean up if there's an error
      console.error('Error in startListeningToDevice:', error);
      await this.stopListeningToDevice(address);
      throw new BluetoothError(`Failed to start listening: ${error?.message || 'Unknown error'}`, 'LISTENING_ERROR');
    }
  }

  /**
   * Stop listening to device data
   */
  public async stopListeningToDevice(address: string): Promise<void> {
    const subscription = this.subscriptions.get(address);
    if (subscription) {
      subscription.remove();
      this.subscriptions.delete(address);
    }
  }

  /**
   * Disconnect from a device
   */
  public async disconnectDevice(address: string): Promise<void> {
    // First stop any active listeners
    await this.stopListeningToDevice(address);

    // Then disconnect from the device
    if (await RNBluetoothClassic.isDeviceConnected(address)) {
      await RNBluetoothClassic.disconnectFromDevice(address);
    }
    
    // Update cache
    const cachedStatus = this.deviceStatusCache.get(address);
    if (cachedStatus) {
      cachedStatus.isConnected = false;
    }
    
    this.connectionState = 'disconnected';
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Stop all active listeners
    for (const [address] of this.subscriptions) {
      await this.stopListeningToDevice(address);
    }
    
    // Clear cache
    this.deviceStatusCache.clear();
    
    // Reset state
    this.connectionState = 'disconnected';
    this.connectionRetryCount = 0;
  }
} 