export const STORAGE_KEYS = {
  USER_CREDENTIALS: '@user_credentials',
  PROJECT_POINTS_PREFIX: '@project_points_',  // Will be used as @project_points_${projectId}
  PROJECT_FEATURES_PREFIX: '@project_features_',  // Added for feature storage
  PROJECT_FEATURE_TYPES_PREFIX: '@project_feature_types_',  // Added for feature type storage
  ACTIVE_PROJECTS: '@active_projects',  // Store list of active project IDs
  LAST_SYNC_TIME: '@last_sync_time',  // Store last successful sync time
  SYNC_METADATA: '@sync_metadata',  // Store sync-related metadata
  UNSYNCED_COUNT: '@unsynced_count_'
} as const; 