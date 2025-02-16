import { useState } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';

export const useSettings = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { settings, handleSettingsChange } = useSettingsContext();

  const handleSettingsPress = () => {
    setIsVisible(true);
  };

  const handleCloseSettings = () => {
    setIsVisible(false);
  };

  return {
    isVisible,
    settings,
    handleSettingsPress,
    handleCloseSettings,
    handleSettingsChange,
  };
};
