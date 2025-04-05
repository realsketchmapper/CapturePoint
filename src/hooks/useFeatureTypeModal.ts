import { useState, useCallback } from 'react';

/**
 * Custom hook for managing feature type modal visibility
 * Provides state and handlers for showing and hiding the feature type modal
 * @returns Object containing modal visibility state and handler functions
 */
export const useFeatureTypeModal = () => {
  // State to track modal visibility
  const [isFeatureTypeModalVisible, setIsFeatureTypeModalVisible] = useState(false);

  /**
   * Handles the feature type button press
   * Shows the feature type modal
   */
  const handleFeatureTypePress = useCallback(() => {
    setIsFeatureTypeModalVisible(true);
  }, []);

  /**
   * Handles closing the feature type modal
   */
  const handleCloseFeatureTypeModal = useCallback(() => {
    setIsFeatureTypeModalVisible(false);
  }, []);

  return {
    isFeatureTypeModalVisible,
    handleFeatureTypePress,
    handleCloseFeatureTypeModal,
  };
}; 