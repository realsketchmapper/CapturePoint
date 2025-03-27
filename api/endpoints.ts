export const API_ENDPOINTS = {
    BASE_URL: 'https://v2.sketchmapper.com',
    LOGIN: '/login',
    PROJECTS: '/projects',
    SYNC_POINTS: '/projects/:projectId/sync-points',
    VALIDATE_TOKEN: '/validate/',
    INACTIVATE_FEATURE: '/:projectId/inactivate-feature',
    ACTIVE_PROJECT_COLLECTED_FEATURES: '/:projectId/active-features',
    PROJECT_FEATURE_TYPES: '/projects/:projectId/features'
} as const;