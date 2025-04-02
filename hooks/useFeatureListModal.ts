import { useState, useCallback } from 'react';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';

export const useFeatureListModal = () => {
  const [isFeatureListModalVisible, setIsFeatureListModalVisible] = useState(false);
  const { selectedFeatureType } = useFeatureTypeContext();

  const showFeatureListModal = useCallback(() => {
    console.log('Showing feature list modal');
    setIsFeatureListModalVisible(true);
  }, []);

  const hideFeatureListModal = useCallback(() => {
    console.log('Hiding feature list modal');
    setIsFeatureListModalVisible(false);
  }, []);

  return {
    isFeatureListModalVisible,
    showFeatureListModal,
    hideFeatureListModal,
    selectedFeatureType
  };
}; 