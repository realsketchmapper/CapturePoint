export interface SettingsProps {
    useTimedCollection: boolean;
    collectionDuration: number;
    useTilt: boolean;
  }
  
export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export interface SettingsButtonProps {
  onPress: () => void;
  iconSize?: number;
  iconColor?: string;
  style?: object;
}

export interface SettingsContextType {
  settings: SettingsProps;
  handleSettingsChange: (newSettings: SettingsProps) => void;
}