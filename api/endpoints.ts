export const API_ENDPOINTS = {
    BASE_URL: 'https://v2.sketchmapper.com',
    LOGIN: '/login',
    PROJECTS: '/projects',
    SYNC_POINTS: '/:projectId/sync-points',
    VALIDATE_TOKEN: '/validate/'
  } as const;