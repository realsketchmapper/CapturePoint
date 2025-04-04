import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { Colors } from '@/src/theme/colors';
export const SyncStatus: React.FC = () => {
  const { syncStatus, syncPoints } = useCollectionContext();
  const { isSyncing, unsyncedCount } = syncStatus;
  const spinValue = useRef(new Animated.Value(0)).current;

  const startSpinAnimation = () => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const handleSync = async () => {
    if (isSyncing) return;
    startSpinAnimation();
    try {
      await syncPoints();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handleSync}
      disabled={isSyncing || unsyncedCount === 0}
    >
      <Animated.View style={{ transform: [{ rotate: isSyncing ? spin : '0deg' }] }}>
        <MaterialIcons 
          name="sync"
          size={18} 
          color={isSyncing ? Colors.DarkOrange : unsyncedCount > 0 ? Colors.Aqua : Colors.BrightGreen}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 2,
    marginHorizontal: 4,
  },
}); 