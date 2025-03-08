// FooterContainer.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { CurrentFeatureDisplay } from './CurrentFeatureDisplay';
import { RMSDisplay } from './RMSDisplay';
import { NMEAQualityDisplay } from './NMEAQualityDisplay';

export const FooterContainer: React.FC = () => {
  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        <View style={styles.leftSection}>
          <CurrentFeatureDisplay />
        </View>
        <View style={styles.rightSection}>
          <NMEAQualityDisplay style={styles.nmeaDisplay} />
          <RMSDisplay />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    backgroundColor: Colors.DarkBlue,
    padding: 10,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nmeaDisplay: {
    flex: 0, // Override the flex: 1 from NMEAQualityDisplay
    marginRight: 16,
  },
});