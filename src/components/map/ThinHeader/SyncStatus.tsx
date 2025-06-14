import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Easing, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useFeatureSync } from '@/hooks/useFeatureSync';
import { Colors } from '@/theme/colors';

export const SyncStatus: React.FC = () => {
  const { activeProject } = useProjectContext();
  const { isSyncing: mapIsSyncing } = useMapContext();
  
  // Use the new hook with the active project ID
  const { 
    unsyncedCount, 
    isSyncing: syncIsSyncing, 
    syncFeatures 
  } = useFeatureSync(activeProject?.id || null);
  
  // Combine sync statuses from different sources
  const isSyncing = syncIsSyncing || mapIsSyncing;
  
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinAnimation = useRef<Animated.CompositeAnimation | null>(null);

  // Debug log whenever sync status changes
  useEffect(() => {
    console.log('Sync status changed:', {
      isSyncing,
      unsyncedCount,
      hasActiveProject: !!activeProject,
      projectId: activeProject?.id
    });
  }, [isSyncing, unsyncedCount, activeProject]);

  const startSpinAnimation = () => {
    spinValue.setValue(0);
    spinAnimation.current = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinAnimation.current.start();
  };

  const stopSpinAnimation = () => {
    if (spinAnimation.current) {
      spinAnimation.current.stop();
      spinAnimation.current = null;
    }
    spinValue.setValue(0);
  };

  const handleSync = async () => {
    if (!activeProject || isSyncing) {
      return;
    }
    
    startSpinAnimation();
    try {
      await syncFeatures();
    } catch (error) {
      console.error('Sync failed with error:', error);
    } finally {
      stopSpinAnimation();
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Determine icon color based on sync state
  const getIconColor = () => {
    if (isSyncing) return Colors.DarkOrange;  // Syncing
    if (unsyncedCount > 0) return Colors.Aqua; // Has unsynced changes
    return Colors.BrightGreen; // All synced
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        !activeProject && styles.disabled
      ]} 
      onPress={handleSync}
      disabled={isSyncing}  // Only disable while actually syncing
    >
      <Animated.View style={{ transform: [{ rotate: isSyncing ? spin : '0deg' }] }}>
        <MaterialIcons 
          name="sync"
          size={18} 
          color={getIconColor()}
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
  disabled: {
    opacity: 0.5,
  }
}); 