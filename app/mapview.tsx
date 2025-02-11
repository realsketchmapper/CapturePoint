// src/app/(map)/mapview.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HeaderContainer } from '../components/map/Header/HeaderContainer';
import { FooterContainer } from '../components/map/Footer/FooterContainer';
import { MapControls } from '../components/map/MapControls';

const MapView: React.FC = () => {
  return (
    <View style={styles.container}>
      <HeaderContainer />
      <MapControls />
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