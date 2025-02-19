import React, { useMemo, useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { NMEA_QUALITY_TYPES } from '@/types/nmea.types';
import { NMEAQualityDisplayProps } from '@/types/nmea.types';

export const NMEAQualityDisplay: React.FC<NMEAQualityDisplayProps> = ({
  style,
}) => {
  const { ggaData } = useNMEAContext();
  const [displayText, setDisplayText] = useState<string>('No Fix');

  const getQualityColor = (quality: string): string => {
    switch (quality) {
      case 'RTK':
        return '#00FF00'; // Green
      case 'Float':
        return '#FFFF00'; // Yellow
      default:
        return '#FF0000'; // Red
    }
  };

  // Memoize the quality text to prevent unnecessary recalculations
  const qualityText = useMemo(() => {
    if (!ggaData) return 'No Fix';
    
    const quality = NMEA_QUALITY_TYPES[ggaData.quality as keyof typeof NMEA_QUALITY_TYPES];
    //const satellites = ggaData.satellites;
    
    return `${quality}`;
  }, [ggaData?.quality]);

  // Update the display text whenever qualityText changes
  useEffect(() => {
    setDisplayText(qualityText);
  }, [qualityText]);

  return (
    <Text 
      style={[
        styles.text,
        { color: getQualityColor(displayText) },
        style
      ]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {displayText}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 22,
    textAlign: 'left',
    fontFamily: 'RobotoSlab-Medium',
    paddingRight: 8
  }
});