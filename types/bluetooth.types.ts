import { BluetoothDevice } from 'react-native-bluetooth-classic';

export type BluetoothDeviceType = 'RTK-PRO' | 'STONEX' | 'EMLID';

export interface DeviceTypeOption {
  id: string;
  name: BluetoothDeviceType;
  namePrefix: string;
}

export interface BluetoothState {
  isScanning: boolean;
  error: string | null;
  isConnecting: boolean;
  connectionError: string | null;
}

export interface BluetoothActions {
  scanDevices: (deviceType: BluetoothDeviceType) => Promise<BluetoothDevice[]>;
  connectToDevice: (device: BluetoothDevice) => Promise<boolean>;
  clearErrors: () => void;
}

export type BluetoothContextType = BluetoothState & BluetoothActions;