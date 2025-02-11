import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import { BluetoothDeviceType } from '@/types/bluetooth.types';
import { BLUETOOTH_DEVICE_TYPES } from '@/utils/constants';
import { deviceStorage } from './deviceStorage';

export class BluetoothManager {
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

  static async disconnectDevice(address: string): Promise<void> {
    if (await RNBluetoothClassic.isDeviceConnected(address)) {
      await RNBluetoothClassic.disconnectFromDevice(address);
    }
  }

  static async isBluetoothEnabled(): Promise<boolean> {
    return RNBluetoothClassic.isBluetoothEnabled();
  }
}