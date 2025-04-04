import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/src/theme/colors';
import { ProjectNameDisplay } from './ProjectNameDisplay';
import { SyncStatus } from './SyncStatus';

export const ThinHeaderContainer: React.FC = () => {
  return (
    <View style={styles.thinHeader}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <ProjectNameDisplay />
        <SyncStatus />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  thinHeader: {
    width: '100%',
    backgroundColor: Colors.DarkBlue,
    paddingHorizontal: 4,
  },
}); 