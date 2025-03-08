import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useFeatureContext } from '@/FeatureContext';
import { CurrentFeatureDisplayProps } from '@/types/currentFeatures.types';
  
  export const CurrentFeatureDisplay: React.FC<CurrentFeatureDisplayProps> = ({
    style,
  }) => {
    const { selectedFeature } = useFeatureContext();
    
    return (
      <Text style={[styles.text, style]}>
        {selectedFeature?.name || 'None'}
      </Text>
    );
  };
  
  const styles = StyleSheet.create({
    text: {
      color: 'white',
      fontSize: 16,
      textAlign: 'left',
      fontFamily: 'RobotoSlab-Regular',
      flex: 1,
      marginRight: 16,
      paddingTop: 0,
      paddingLeft: 4
    }
  });