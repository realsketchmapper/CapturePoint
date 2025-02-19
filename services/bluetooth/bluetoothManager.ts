import RNBluetoothClassic, { 
  BluetoothDevice, 
  BluetoothEventSubscription 
} from 'react-native-bluetooth-classic';
import { BluetoothDeviceType } from '@/types/bluetooth.types';
import { BLUETOOTH_DEVICE_TYPES } from '@/utils/constants';
import { deviceStorage } from './deviceStorage';

export class BluetoothManager {
  private static subscriptions: Map<string, BluetoothEventSubscription> = new Map();

  static async scanDevices(deviceType: BluetoothDeviceType): Promise<BluetoothDevice[]> {
    const enabled = await RNBluetoothClassic.isBluetoothEnabled();
    if (!enabled) {
      throw new Error('Please enable Bluetooth in your device settings');
    }

    const devices = await RNBluetoothClassic.getBondedDevices();
    const deviceTypeConfig = BLUETOOTH_DEVICE_TYPES.find(type => type.name === deviceType);

    return devices.filter(device =>
      device.name && deviceTypeConfig &&
      device.name.startsWith(deviceTypeConfig.namePrefix)
    );
  }

  static async connectToDevice(device: BluetoothDevice): Promise<boolean> {
    const isAlreadyConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
    if (isAlreadyConnected) {
      return true;
    }

    // Attempt connection with timeout
    await Promise.race([
      RNBluetoothClassic.connectToDevice(device.address),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);

    // Verify connection
    const isConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
    if (!isConnected) {
      throw new Error('Device connection failed. Please ensure the device is turned on and in range.');
    }

    // Store the connected device
    await deviceStorage.storeLastConnectedDevice(device);
    return true;
  }

  static async startListeningToDevice(
    address: string,
    onDataReceived: (data: string) => void
  ): Promise<void> {
    // Check if device is connected
    if (!await RNBluetoothClassic.isDeviceConnected(address)) {
      throw new Error('Device is not connected');
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

    } catch (error) {
      // Clean up if there's an error
      console.error('Error in startListeningToDevice:', error);
      await this.stopListeningToDevice(address);
      throw error;
    }
  }

  static async stopListeningToDevice(address: string): Promise<void> {
    const subscription = this.subscriptions.get(address);
    if (subscription) {
      subscription.remove();
      this.subscriptions.delete(address);
    }
  }

  static async disconnectDevice(address: string): Promise<void> {
    // First stop any active listeners
    await this.stopListeningToDevice(address);

    // Then disconnect from the device
    if (await RNBluetoothClassic.isDeviceConnected(address)) {
      await RNBluetoothClassic.disconnectFromDevice(address);
    }
  }

  static async isBluetoothEnabled(): Promise<boolean> {
    return RNBluetoothClassic.isBluetoothEnabled();
  }
}