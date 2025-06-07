export interface LoadingPopupProps {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  showMessages?: boolean;
  messageInterval?: number;
}

export interface MotivationalMessage {
  id: number;
  text: string;
  category: 'motivational' | 'funny' | 'tech';
} 