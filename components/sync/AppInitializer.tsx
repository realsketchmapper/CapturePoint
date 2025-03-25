import React, { useEffect, useRef, useContext, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { AuthContext } from '@/contexts/AuthContext';
import { AuthService } from '@/services/auth/authService';
import NetInfo from '@react-native-community/netinfo';


const AppInitializer: React.FC = () => {
  const { syncPoints, syncStatus } = useCollectionContext();
  const { unsyncedCount, isSyncing } = syncStatus;
  
  // Access auth context
  const authContext = useContext(AuthContext);
  const { user, isInitialized, isOffline } = authContext || {};
  
  // Track if initial sync was attempted
  const [initialSyncAttempted, setInitialSyncAttempted] = useState(false);
  
  const appState = useRef(AppState.currentState);
  const syncInProgress = useRef(false);
  
  // Check if device is online with better error handling
  const isOnline = async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      return !!state.isConnected && state.isInternetReachable !== false;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  };
  
  // Enhanced checks for sync capability
  const canSync = async (): Promise<boolean> => {
    // Don't allow multiple syncs simultaneously
    if (syncInProgress.current || isSyncing) {
      console.log('AppInitializer: Sync already in progress');
      return false;
    }
    
    // Check if auth is initialized
    if (!isInitialized) {
      console.log('AppInitializer: Auth not yet initialized');
      return false;
    }
    
    // Make sure we have a valid user with an ID before attempting to sync
    if (!user || !user.id) {
      console.log('AppInitializer: Cannot sync - user not authenticated');
      return false;
    }
    
    // Check if user is offline
    if (isOffline) {
      // Verify if we're actually online - might need to update auth state
      const online = await isOnline();
      if (online) {
        // We appear to be online but auth thinks we're offline
        // Validate token to potentially update auth state
        try {
          const isValid = await AuthService.validateToken();
          if (!isValid) {
            console.log('AppInitializer: Token invalid despite network being available');
            return false;
          }
          // Token is valid, but context hasn't updated yet - give it time
          console.log('AppInitializer: Network available but auth state is offline');
          return false;
        } catch (error) {
          console.log('AppInitializer: Token validation failed, cannot sync');
          return false;
        }
      } else {
        console.log('AppInitializer: Cannot sync - device is offline');
        return false;
      }
    }
    
    if (unsyncedCount === 0) {
      console.log('AppInitializer: No items to sync');
      return false;
    }
    
    return true;
  };
  
  // Initial sync attempt when component mounts
  useEffect(() => {
    if (initialSyncAttempted || !isInitialized) return;
    
    const attemptInitialSync = async () => {
      const canSyncNow = await canSync();
      if (!canSyncNow) {
        setInitialSyncAttempted(true);
        return;
      }
      
      try {
        syncInProgress.current = true;
        const online = await isOnline();
        if (online) {
          await syncPoints();
        }
      } catch (error) {
        console.error('Error during initial sync:', error);
      } finally {
        syncInProgress.current = false;
        setInitialSyncAttempted(true);
      }
    };
    
    const timeout = setTimeout(attemptInitialSync, 1500);
    return () => clearTimeout(timeout);
  }, [isInitialized, initialSyncAttempted, syncPoints, unsyncedCount]);
  
  // Reset initialSyncAttempted if user changes or unsynced count increases
  useEffect(() => {
    if (user?.id && unsyncedCount > 0) {
      setInitialSyncAttempted(false);
    }
  }, [user?.id, unsyncedCount]);
  
  // Sync when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        const canSyncNow = await canSync();
        if (!canSyncNow) return;
        
        try {
          syncInProgress.current = true;
          const online = await isOnline();
          if (online) {
            await syncPoints();
          }
        } catch (error) {
          console.error('Foreground sync error:', error);
        } finally {
          syncInProgress.current = false;
        }
      }
      
      appState.current = nextAppState;
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [syncPoints, unsyncedCount]);
  
  // Periodic sync attempt (every 5 minutes if there are unsynced items)
  useEffect(() => {
    if (!user?.id || unsyncedCount === 0) return;
    
    const interval = setInterval(async () => {
      const canSyncNow = await canSync();
      if (!canSyncNow) return;
      
      try {
        syncInProgress.current = true;
        const online = await isOnline();
        if (online) {
          await syncPoints();
        }
      } catch (error) {
        console.error('Periodic sync error:', error);
      } finally {
        syncInProgress.current = false;
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user?.id, syncPoints, unsyncedCount]);
  
  // Network status change listener
  useEffect(() => {
    if (!user?.id || unsyncedCount === 0) return;
    
    const handleNetworkChange = async (state: any) => {
      const isConnected = state.isConnected === true && state.isInternetReachable !== false;
      
      if (isConnected && isOffline) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const canSyncNow = await canSync();
        if (!canSyncNow) return;
        
        try {
          syncInProgress.current = true;
          await syncPoints();
        } catch (error) {
          console.error('Network reconnect sync error:', error);
        } finally {
          syncInProgress.current = false;
        }
      }
    };
    
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    return () => unsubscribe();
  }, [user?.id, isOffline, syncPoints, unsyncedCount]);
  
  // This component doesn't render anything
  return null;
};

export default AppInitializer;