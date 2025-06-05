export type BasemapStyle = 'satellite' | 'streets';

export interface SettingsProps {
    useTimedCollection: boolean;
    collectionDuration: number;
    useTilt: boolean;
    basemapStyle: BasemapStyle;
    hideCollectionButtonForRTKPro: boolean;
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
  handleSettingsChange: (settings: SettingsProps) => void;
  updateSetting: <K extends keyof SettingsProps>(key: K, value: SettingsProps[K]) => Promise<void>;
  error: string | null;
  isLoading: boolean;
}