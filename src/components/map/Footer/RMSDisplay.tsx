import React, { useMemo, useEffect, useState } from 'react';
import { Text, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { NMEAParser } from '@/services/gnss/nmeaParser';
import { RMSDisplayProps, RMSValues } from '@/types/nmea.types';
import { Colors } from '@/theme/colors';

const RMS_THRESHOLDS = {
    GREEN: 0.1,    // 0.1ft and below
    YELLOW: 0.5,   // 0.11ft to 0.5ft
    // above 0.5ft will be red
  };
  
  const getRMSStyle = (value: string) => {
    if (value === '--') {
      return {
        backgroundColor: Colors.VeryLightGrey,
        color: Colors.Grey,
        borderColor: Colors.VeryLightGrey,
      };
    }
    
    const numValue = parseFloat(value);
    if (numValue <= RMS_THRESHOLDS.GREEN) {
      return {
        backgroundColor: Colors.DarkBlue,
        color: Colors.BrightGreen,
        borderColor: Colors.BrightGreen,
      };
    }
    if (numValue <= RMS_THRESHOLDS.YELLOW) {
      return {
        backgroundColor: Colors.DarkBlue,
        color: Colors.Yellow,
        borderColor: Colors.Yellow,
      };
    }
    return {
      backgroundColor: Colors.DarkBlue,
      color: Colors.BrightRed,
      borderColor: Colors.BrightRed,
    };
  };

export const RMSDisplay: React.FC<RMSDisplayProps> = ({
  containerStyle,
  textStyle,
  labelStyle,
}) => {
  const { gstData, ggaData } = useNMEAContext();
  const [displayValues, setDisplayValues] = useState<RMSValues>({
    horizontal: '--',
    vertical: '--'
  });

  // Memoize RMS calculations to prevent unnecessary recalculations
  const rmsValues = useMemo(() => {
    if (!gstData) {
      // Fallback to HDOP-based approximation if GST data isn't available
      if (ggaData?.hdop) {
        return {
          horizontal: (ggaData.hdop * 2.5).toFixed(2),
          vertical: (ggaData.hdop * 4).toFixed(2)
        };
      }
      return {
        horizontal: '--',
        vertical: '--'
      };
    }

    // Calculate actual RMS values from GST data
    const horizontalRMS = NMEAParser.calculateHorizontalRMS(gstData).toFixed(2);
    const verticalRMS = NMEAParser.getVerticalRMS(gstData).toFixed(2);

    return {
      horizontal: horizontalRMS,
      vertical: verticalRMS
    };
  }, [gstData, ggaData?.hdop]); // Recalculate when either GST data or HDOP changes

  // Update display values when RMS calculations change
  useEffect(() => {
    setDisplayValues(rmsValues);
  }, [rmsValues]);

  const horizontalStyle = getRMSStyle(displayValues.horizontal);
  const verticalStyle = getRMSStyle(displayValues.vertical);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.mainLabel, labelStyle]}>Accuracy (ft)</Text>
      <View style={styles.valuesContainer}>
        <View style={styles.valueRow}>
          <Text style={styles.valueLabel}>H:</Text>
          <View style={[
            styles.valueContainer,
            {
              backgroundColor: horizontalStyle.backgroundColor,
              borderColor: horizontalStyle.borderColor,
            }
          ]}>
            <Text 
              style={[
                styles.valueText, 
                { color: horizontalStyle.color },
                textStyle
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayValues.horizontal}
            </Text>
          </View>
        </View>
        
        <View style={styles.valueRow}>
          <Text style={styles.valueLabel}>V:</Text>
          <View style={[
            styles.valueContainer,
            {
              backgroundColor: verticalStyle.backgroundColor,
              borderColor: verticalStyle.borderColor,
            }
          ]}>
            <Text 
              style={[
                styles.valueText, 
                { color: verticalStyle.color },
                textStyle
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayValues.vertical}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

interface Styles {
  container: ViewStyle;
  mainLabel: TextStyle;
  valuesContainer: ViewStyle;
  valueRow: ViewStyle;
  valueLabel: TextStyle;
  valueContainer: ViewStyle;
  valueText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainLabel: {
    color: Colors.Grey,
    fontSize: 9,
    fontFamily: 'RobotoSlab-Regular',
    marginBottom: 3,
    textAlign: 'center',
  },
  valuesContainer: {
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  valueLabel: {
    color: Colors.DarkBlue,
    fontSize: 9,
    fontFamily: 'RobotoSlab-Regular',
    width: 12,
    textAlign: 'right',
    marginRight: 4,
  },
  valueContainer: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  valueText: {
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'RobotoSlab-Regular',
    fontWeight: '600',
  }
});