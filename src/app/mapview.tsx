import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HeaderContainer } from '@/components/map/Header/HeaderContainer';
import { FooterContainer } from '@/components/map/Footer/FooterContainer';
import { MapControls } from '@/components/map/MapControls';
import { LocationPermissionHandler } from '@/components/shared/LocationPermissionHandler';

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