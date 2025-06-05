import React, { useMemo, useEffect, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { NMEA_QUALITY_TYPES } from '@/types/nmea.types';
import { NMEAQualityDisplayProps } from '@/types/nmea.types';
import { Colors } from '@/theme/colors';

export const NMEAQualityDisplay: React.FC<NMEAQualityDisplayProps> = ({
  style,
}) => {
  const { ggaData } = useNMEAContext();
  const { locationSource } = useLocationContext();
  const [displayText, setDisplayText] = useState<string>('No Fix');

  const getQualityStyle = (quality: string) => {
    switch (quality) {
      case 'RTK':
        return {
          backgroundColor: Colors.DarkBlue,
          color: Colors.BrightGreen,
          borderColor: Colors.BrightGreen,
        };
      case 'Float':
        return {
          backgroundColor: Colors.DarkBlue,
          color: Colors.Yellow,
          borderColor: Colors.Yellow,
        };
      case 'Device':
        return {
          backgroundColor: Colors.Grey,
          color: 'white',
          borderColor: Colors.Grey,
        };
      default:
        return {
          backgroundColor: Colors.VeryLightGrey,
          color: Colors.BrightRed,
          borderColor: Colors.BrightRed,
        };
    }
  };

  // Memoize the quality text to prevent unnecessary recalculations
  const qualityText = useMemo(() => {
    if (locationSource === 'device') {
      return 'Device';
    }
    
    if (!ggaData) return 'No Fix';
    
    const quality = NMEA_QUALITY_TYPES[ggaData.quality as keyof typeof NMEA_QUALITY_TYPES];
    
    return quality;
  }, [ggaData?.quality, locationSource]);

  // Update the display text whenever qualityText changes
  useEffect(() => {
    setDisplayText(qualityText);
  }, [qualityText]);

  const qualityStyle = getQualityStyle(displayText);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>RTK Status</Text>
      <View style={[
        styles.statusContainer,
        {
          backgroundColor: qualityStyle.backgroundColor,
          borderColor: qualityStyle.borderColor,
        }
      ]}>
        <Text 
          style={[
            styles.text,
            { color: qualityStyle.color }
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    color: Colors.Grey,
    fontFamily: 'RobotoSlab-Regular',
    marginBottom: 2,
    textAlign: 'center',
  },
  statusContainer: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    minWidth: 55,
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'RobotoSlab-Medium',
    fontWeight: '600',
  }
});