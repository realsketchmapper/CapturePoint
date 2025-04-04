import React, { useMemo, useEffect, useState } from 'react';
import { Text, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { NMEAParser } from '@/services/gnss/nmeaParser';
import { RMSDisplayProps, RMSValues } from '@/types/nmea.types';
import { Colors } from '@/src/theme/colors';

const RMS_THRESHOLDS = {
    GREEN: 0.1,    // 0.1ft and below
    YELLOW: 0.5,   // 0.11ft to 0.5ft
    // above 0.5ft will be red
  };
  
  const getRMSColor = (value: string): string => {
    if (value === '--') return Colors.DarkBlue; // White for no value
    const numValue = parseFloat(value);
    if (numValue <= RMS_THRESHOLDS.GREEN) return Colors.BrightGreen;  // Green
    if (numValue <= RMS_THRESHOLDS.YELLOW) return Colors.Yellow; // Yellow
    return Colors.BrightRed; // Red
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

  const HorizontalValue = useMemo(() => (
    <View style={styles.valueContainer}>
      <Text style={[styles.label, labelStyle]}>H:</Text>
      <View style={styles.valueTextContainer}>
        <Text 
          style={[
            styles.text, 
            { color: getRMSColor(displayValues.horizontal) },
            textStyle
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayValues.horizontal}ft
        </Text>
      </View>
    </View>
  ), [displayValues.horizontal, labelStyle, textStyle]);

  const VerticalValue = useMemo(() => (
    <View style={styles.valueContainer}>
      <Text style={[styles.label, labelStyle]}>V:</Text>
      <View style={styles.valueTextContainer}>
        <Text 
          style={[
            styles.text, 
            { color: getRMSColor(displayValues.vertical) },
            textStyle
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayValues.vertical}ft
        </Text>
      </View>
    </View>
  ), [displayValues.vertical, labelStyle, textStyle]);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.valuesStack}>
        {HorizontalValue}
        {VerticalValue}
      </View>
    </View>
  );
};

interface Styles {
  container: ViewStyle;
  valuesStack: ViewStyle;
  valueContainer: ViewStyle;
  valueTextContainer: ViewStyle;
  label: TextStyle;
  text: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  valuesStack: {
    alignItems: 'flex-start',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    width: 45,
  },
  valueTextContainer: {
    width: 55,
  },
  label: {
    color: Colors.DarkBlue,
    fontSize: 10,
    fontFamily: 'RobotoSlab-Regular',
    width: 15,
  },
  text: {
    color: Colors.DarkBlue,
    fontSize: 10,
    textAlign: 'left',
    fontFamily: 'RobotoSlab-Regular',
  }
});