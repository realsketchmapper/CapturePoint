export const AUTH_CONFIG = {
  NETWORK: {
    TIMEOUT: 10000, // 10 seconds
    CHECK_TIMEOUT: 3000, // 3 seconds
    INITIAL_VALIDATION_TIMEOUT: 10000, // 10 seconds
  },
  RETRY: {
    MAX_ATTEMPTS: 2,
    DELAY: 2000, // 2 seconds
    BACKOFF_FACTOR: 2,
  },
  STORAGE: {
    CREDENTIALS_KEY: 'user_credentials',
    TOKEN_KEY: 'auth_token',
  },
} as const; 