// src/components/ProjectNameDisplay.tsx
import { FeatureContext } from '@/contexts/FeatureContext';
import React, { useContext }from 'react';
import { Text, StyleSheet } from 'react-native';
import { useFeature } from '@/hooks/useFeature';

interface CurrentFeatureDisplayProps {
    text?: string;
    style?: object;
  }
  
  export const CurrentFeatureDisplay: React.FC<CurrentFeatureDisplayProps> = ({
    text,
    style,
  }) => {
    const { selectedFeature } = useFeature();
    
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