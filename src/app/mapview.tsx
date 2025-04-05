import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HeaderContainer } from '@/src/components/map/Header/HeaderContainer';
import { FooterContainer } from '@/src/components/map/Footer/FooterContainer';
import { MapControls } from '@/src/components/map/MapControls';
import { LocationPermissionHandler } from '@/src/components/shared/LocationPermissionHandler';

const MapView: React.FC = () => {
  return (
    <View style={styles.container}>
      <HeaderContainer />
      <MapControls />
      <LocationPermissionHandler />
      <FooterContainer />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MapView; 