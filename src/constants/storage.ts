export const STORAGE_KEYS = {
  USER_CREDENTIALS: '@user_credentials',
  COLLECTED_FEATURES: '@collected_features',
  LAST_SESSION_TIMESTAMP: '@last_session_timestamp',
  PROJECTS: '@stored_projects',
  FEATURE_TYPES_PREFIX: '@stored_feature_types', // Prefix for feature types storage
  FEATURE_TYPE_IMAGES: '@feature_type_images' // For storing feature type images locally
} as const; 