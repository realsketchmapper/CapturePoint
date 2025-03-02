export interface SettingsProps {
    useTimedCollection: boolean;
    collectionDuration: number;
    useTilt: boolean;
  }
  
export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}