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
          <View style={styles.statusSection}>
            <NMEAQualityDisplay style={styles.nmeaDisplay} />
            <RMSDisplay containerStyle={styles.rmsDisplay} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    backgroundColor: Colors.OffWhite,
    padding: 5,
    borderTopWidth: 2,
    borderTopColor: Colors.DarkBlue,
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
    alignItems: 'flex-end',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nmeaDisplay: {
    // Additional styling can be added here if needed
  },
  rmsDisplay: {
    // Additional styling can be added here if needed
  },
});