import { BluetoothDevice } from 'react-native-bluetooth-classic';

export type BluetoothDeviceType = 'RTK-PRO' | 'STONEX' | 'EMLID';

// Add connection event types
export type BluetoothConnectionEvent = 'connected' | 'disconnected' | 'data_timeout';

export interface BluetoothConnectionEventData {
  event: BluetoothConnectionEvent;
  device: BluetoothDevice;
  timestamp: Date;
  reason?: string;
}

export interface DeviceTypeOption {
  id: string;
  name: BluetoothDeviceType;
  namePrefix: string;
  gnssHeight: number;
}

export type BluetoothAction =
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SCANNING'; payload: boolean }
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_DISCONNECTING'; payload: boolean }
  | { type: 'SET_CONNECTION_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTED_DEVICE'; payload: BluetoothDevice | null }
  | { type: 'SET_BLUETOOTH_ENABLED'; payload: boolean }
  | { type: 'SET_CONNECTION_EVENT'; payload: BluetoothConnectionEventData | null }
  | { type: 'CLEAR_ERRORS' };

export interface BluetoothState {
  error: string | null;
  isScanning: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  connectionError: string | null;
  connectedDevice: BluetoothDevice | null;
  isBluetoothEnabled: boolean;
  lastConnectionEvent: BluetoothConnectionEventData | null;
}

export interface BluetoothActions {
  scanDevices: (deviceType: BluetoothDeviceType) => Promise<BluetoothDevice[]>;
  connectToDevice: (device: BluetoothDevice) => Promise<boolean>;
  disconnectDevice: (address: string) => Promise<void>;
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

export interface BluetoothContextType {
  error: string | null;
  isScanning: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  connectionError: string | null;
  connectedDevice: BluetoothDevice | null;
  isBluetoothEnabled: boolean;
  lastConnectionEvent: BluetoothConnectionEventData | null;
  scanDevices: (deviceType: BluetoothDeviceType) => Promise<BluetoothDevice[]>;
  connectToDevice: (device: BluetoothDevice) => Promise<boolean>;
  connectToLastDevice: () => Promise<void>;
  disconnectDevice: (address: string) => Promise<void>;
  disconnectFromDevice: () => Promise<void>;
  clearErrors: () => void;
}