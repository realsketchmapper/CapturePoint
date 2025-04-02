import { useState } from 'react';

export const useFeatureModal = () => {
  const [isFeatureModalVisible, setIsFeatureModalVisible] = useState(false);

  const handleFeaturePress = () => {
    console.log('Feature button pressed, setting modal visible');
    setIsFeatureModalVisible(true);
  };

  const handleCloseFeatureModal = () => {
    console.log('Closing feature modal');
    setIsFeatureModalVisible(false);
  };

  return {
    isFeatureModalVisible,
    handleFeaturePress,
    handleCloseFeatureModal,
  };
};