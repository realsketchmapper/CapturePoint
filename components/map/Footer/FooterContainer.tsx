// src/app/(map)/components/Footer/FooterContainer.tsx
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors } from '@/theme/colors';
import { CurrentFeatureDisplay } from './CurrentFeatures';

export const FooterContainer: React.FC = () => {
  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        <CurrentFeatureDisplay />
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});