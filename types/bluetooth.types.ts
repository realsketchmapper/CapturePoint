import { BluetoothDevice } from 'react-native-bluetooth-classic';

export type BluetoothDeviceType = 'RTK-PRO' | 'STONEX' | 'EMLID';

export interface DeviceTypeOption {
  id: string;
  name: BluetoothDeviceType;
  namePrefix: string;
  gnssHeight: number;
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
  disconnectDevice: (address: string) => Promise<void>;  // Added this line
  clearErrors: () => void;
}

export interface BluetoothButtonProps {
  onPress: () => void;
  iconSize?: number;
  iconColor?: string;
  style?: object;
}

export interface DeviceTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDeviceType: (deviceType: BluetoothDeviceType) => void;
}

export interface DeviceSelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onDeviceSelected: (device: BluetoothDevice) => Promise<boolean>;
  deviceType: BluetoothDeviceType;
}

export type BluetoothContextType = BluetoothState & BluetoothActions;