import { useState, useCallback, useEffect } from 'react';
import { syncService } from '@/services/sync/syncService';
import { featureStorageService } from '@/services/storage/featureStorageService';

export const useFeatureSync = (projectId?: number | null) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load the unsynced count on mount or when projectId changes
  useEffect(() => {
    const loadUnsyncedCount = async () => {
      if (!projectId) return;
      
      try {
        const unsyncedFeatures = await featureStorageService.getUnsyncedFeatures(projectId);
        setUnsyncedCount(unsyncedFeatures.length);
      } catch (err) {
        console.error('Error loading unsynced count:', err);
      }
    };
    
    loadUnsyncedCount();
  }, [projectId]);

  /**
   * Synchronize features for the specified project
   */
  const syncFeatures = useCallback(async (projectIdToSync?: number): Promise<boolean> => {
    const effectiveProjectId = projectIdToSync || projectId;
    
    if (!effectiveProjectId) {
      setError('No project ID provided for sync');
      return false;
    }
    
    setIsSyncing(true);
    setError(null);
    
    try {
      const result = await syncService.syncProject(effectiveProjectId);
      
      if (result.success) {
        setLastSyncTime(new Date());
        
        // Update the unsynced count after sync
        const unsyncedFeatures = await featureStorageService.getUnsyncedFeatures(effectiveProjectId);
        setUnsyncedCount(unsyncedFeatures.length);
      }
      
      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during sync';
      console.error('Error syncing features:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [projectId]);

  /**
   * Sync only the unsynced features
   */
  const syncUnsyncedFeatures = useCallback(async (projectIdToSync?: number): Promise<void> => {
    const effectiveProjectId = projectIdToSync || projectId;
    
    if (!effectiveProjectId) {
      setError('No project ID provided for sync');
      return;
    }
    
    try {
      const unsyncedFeatures = await featureStorageService.getUnsyncedFeatures(effectiveProjectId);
      
      if (unsyncedFeatures.length > 0) {
        await syncFeatures(effectiveProjectId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during sync';
      console.error('Error syncing unsynced features:', errorMessage);
      setError(errorMessage);
    }
  }, [projectId, syncFeatures]);

  return {
    isSyncing,
    lastSyncTime,
    unsyncedCount,
    error,
    syncFeatures,
    syncUnsyncedFeatures
  };
}; 