import { useState } from 'react';

export const useFeatureModal = () => {
  const [isFeatureModalVisible, setIsFeatureModalVisible] = useState(false);

  const handleFeaturePress = () => {
    setIsFeatureModalVisible(true);
  };

  const handleCloseFeatureModal = () => {
    setIsFeatureModalVisible(false);
  };

  return {
    isFeatureModalVisible,
    handleFeaturePress,
    handleCloseFeatureModal,
  };
};