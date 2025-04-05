import { useState, useCallback } from 'react';
import { useSettingsContext } from '@/src/contexts/SettingsContext';
import { SettingsProps } from '@/src/types/settings.types';

/**
 * Custom hook for managing settings modal visibility and settings state
 * Provides a simplified interface for working with settings
 * @returns Object containing settings state, visibility state, and handler functions
 */
export const useSettings = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { settings, handleSettingsChange, updateSetting } = useSettingsContext();

  /**
   * Shows the settings modal
   */
  const handleSettingsPress = useCallback(() => {
    setIsVisible(true);
  }, []);

  /**
   * Closes the settings modal
   */
  const handleCloseSettings = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    settings,
    handleSettingsPress,
    handleCloseSettings,
    handleSettingsChange,
    updateSetting,
  };
}; 