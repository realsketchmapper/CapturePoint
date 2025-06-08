export const API_ENDPOINTS = {
    BASE_URL: 'https://v2.sketchmapper.com',
    LOGIN: '/login',
    PROJECTS: '/projects', // Get all projects
    SYNC_COLLECTED_FEATURES: '/:projectId/sync-points', // Get sync points for a project
    VALIDATE_TOKEN: '/validate/', // Validate token
    INACTIVATE_FEATURE: '/:projectId/inactivate-feature', // Inactivate a collected feature
    ACTIVE_FEATURES: '/:projectId/active-features', // Get active collected features for a project
    FEATURE_TYPES: '/projects/:projectId/feature_types', // Get feature type definitions for a project
    SYNC_FEATURES: '/:projectId/sync-features', // Sync features to server
    SYNC_PROJECT_ATTRIBUTES: '/:projectId/sync-attributes' // Sync project attributes like footage data
} as const; 