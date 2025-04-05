import { AxiosError } from 'axios';

export enum AuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  NO_CREDENTIALS = 'NO_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNKNOWN = 'UNKNOWN'
}

export class AuthError extends Error {
  constructor(
    message: string,
    public type: AuthErrorType,
    public originalError?: Error | AxiosError
  ) {
    super(message);
    this.name = 'AuthError';
  }

  static fromAxiosError(error: AxiosError): AuthError {
    if (!error.response) {
      return new AuthError('Network error occurred', AuthErrorType.NETWORK_ERROR, error);
    }

    switch (error.response.status) {
      case 401:
        return new AuthError('Invalid credentials', AuthErrorType.INVALID_CREDENTIALS, error);
      case 403:
        return new AuthError('Token expired', AuthErrorType.TOKEN_EXPIRED, error);
      case 500:
        return new AuthError('Server error occurred', AuthErrorType.SERVER_ERROR, error);
      default:
        return new AuthError('Unknown error occurred', AuthErrorType.UNKNOWN, error);
    }
  }
}

export const logAuthError = (error: AuthError, context: string): void => {
  console.error(`[Auth Error] ${context}:`, {
    type: error.type,
    message: error.message,
    originalError: error.originalError,
    timestamp: new Date().toISOString(),
  });
}; 