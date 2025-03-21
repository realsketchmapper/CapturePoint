import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Easing, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Colors } from '@/theme/colors';

export const SyncStatus: React.FC = () => {
  const { syncStatus, syncPoints } = useCollectionContext();
  const { activeProject } = useProjectContext();
  const { isSyncing, unsyncedCount } = syncStatus;
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
  }, [syncStatus, activeProject]);

  const startSpinAnimation = () => {
    console.log('Starting spin animation');
    spinValue.setValue(0); // Reset the animation
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
    console.log('Stopping spin animation');
    if (spinAnimation.current) {
      spinAnimation.current.stop();
      spinAnimation.current = null;
    }
    spinValue.setValue(0);
  };

  const handleSync = async () => {
    console.log('Sync icon clicked');
    console.log('Current state:', { isSyncing, activeProject, unsyncedCount });
    
    if (!activeProject) {
      console.log('No active project, cannot sync');
      return;
    }
    
    if (isSyncing) {
      console.log('Already syncing, ignoring click');
      return;
    }
    
    console.log('Starting sync for project:', activeProject.id);
    startSpinAnimation();
    try {
      const success = await syncPoints();
      console.log('Sync completed with result:', success);
      if (!success) {
        console.error('Sync failed');
      }
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