import axios, { AxiosError } from 'axios';
import { User, LoginResponse, StoredCredentials } from '../../types/auth.types';
import { tokenStorage } from './tokenStorage';
import { api } from '../../api/clients';
import { ExtendedAxiosRequestConfig } from '../../types/api.types';
import { AUTH_CONFIG } from './config';
import { API_ENDPOINTS } from '../../api/endpoints';
import { AuthError, AuthErrorType, logAuthError } from './errors';
import { checkNetworkConnectivity, withRetry } from './network';

export class AuthService {
  /**
   * Attempts to log in a user with the provided credentials
   * @param email User's email
   * @param password User's password
   * @returns User object if login successful
   * @throws AuthError if login fails
   */
  static async login(email: string, password: string): Promise<User> {
    try {
      // Clear any existing credentials first
      await tokenStorage.clearCredentials();

      // Check network connectivity
      const isConnected = await checkNetworkConnectivity();

      if (!isConnected) {
        return this.attemptOfflineLogin();
      }

      // Attempt online login with retry
      return await withRetry(
        () => this.attemptOnlineLogin(email, password),
        'login'
      );
    } catch (error) {
      if (error instanceof AuthError) {
        logAuthError(error, 'login');
        throw error;
      }

      const authError = error instanceof AxiosError
        ? AuthError.fromAxiosError(error)
        : new AuthError(
            'Login failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
            AuthErrorType.UNKNOWN,
            error instanceof Error ? error : undefined
          );

      logAuthError(authError, 'login');
      throw authError;
    }
  }

  /**
   * Attempts to log in a user with stored credentials when offline
   * @returns User object with offline flag
   * @throws AuthError if no stored credentials found
   */
  private static async attemptOfflineLogin(): Promise<User> {
    const credentials = await tokenStorage.getStoredCredentials();

    if (!credentials) {
      throw new AuthError(
        'No stored credentials found',
        AuthErrorType.NO_CREDENTIALS
      );
    }

    return this.createUserFromCredentials(credentials, true);
  }

  /**
   * Attempts to log in a user with the provided credentials when online
   * @param email User's email
   * @param password User's password
   * @returns User object if login successful
   * @throws AuthError if login fails
   */
  private static async attemptOnlineLogin(
    email: string,
    password: string
  ): Promise<User> {
    try {
      const response = await api.post<LoginResponse>(
        API_ENDPOINTS.LOGIN,
        { email, password },
        {
          timeout: AUTH_CONFIG.NETWORK.TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data) {
        throw new AuthError(
          'No response data received from server',
          AuthErrorType.SERVER_ERROR
        );
      }

      const { token, user_id, user_name: name } = response.data;

      // Store credentials
      await tokenStorage.storeCredentials(token, user_id.toString(), email, name);

      // Return user object
      return {
        id: user_id,
        email,
        name,
        isOffline: false,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        throw AuthError.fromAxiosError(error);
      }
      throw error;
    }
  }

  /**
   * Logs out the current user by clearing stored credentials
   */
  static async logout(): Promise<void> {
    try {
      await tokenStorage.clearCredentials();
    } catch (error) {
      logAuthError(
        new AuthError(
          'Failed to logout',
          AuthErrorType.UNKNOWN,
          error instanceof Error ? error : undefined
        ),
        'logout'
      );
      throw error;
    }
  }

  /**
   * Gets the current user from stored credentials
   * @returns User object or null if no user is logged in
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const credentials = await tokenStorage.getStoredCredentials();

      if (!credentials) {
        return null;
      }

      const isConnected = await checkNetworkConnectivity();

      if (!isConnected) {
        return this.createUserFromCredentials(credentials, true);
      }

      try {
        const isValid = await this.validateToken(true);

        if (!isValid) {
          return this.createUserFromCredentials(credentials, true);
        }

        return this.createUserFromCredentials(credentials, false);
      } catch (error) {
        return this.createUserFromCredentials(credentials, true);
      }
    } catch (error) {
      logAuthError(
        new AuthError(
          'Failed to get current user',
          AuthErrorType.UNKNOWN,
          error instanceof Error ? error : undefined
        ),
        'getCurrentUser'
      );
      return null;
    }
  }

  /**
   * Validates the current token with the server
   * @param isInitialValidation Whether this is the initial validation on app start
   * @returns True if token is valid, false otherwise
   */
  static async validateToken(isInitialValidation = false): Promise<boolean> {
    try {
      const credentials = await tokenStorage.getStoredCredentials();

      if (!credentials?.token) {
        return false;
      }

      const isConnected = await checkNetworkConnectivity();

      if (!isConnected) {
        return false;
      }

      return await withRetry(
        async () => {
          await api.get(API_ENDPOINTS.VALIDATE_TOKEN, {
            timeout: isInitialValidation
              ? AUTH_CONFIG.NETWORK.INITIAL_VALIDATION_TIMEOUT
              : AUTH_CONFIG.NETWORK.TIMEOUT,
          } as ExtendedAxiosRequestConfig);
          return true;
        },
        'validateToken'
      );
    } catch (error) {
      logAuthError(
        new AuthError(
          'Token validation failed',
          AuthErrorType.UNKNOWN,
          error instanceof Error ? error : undefined
        ),
        'validateToken'
      );
      return false;
    }
  }

  /**
   * Creates a User object from stored credentials
   * @param credentials Stored credentials
   * @param isOffline Whether the user is offline
   * @returns User object
   */
  private static createUserFromCredentials(
    credentials: StoredCredentials,
    isOffline: boolean
  ): User {
    return {
      id: parseInt(credentials.userId),
      email: credentials.email,
      name: credentials.name,
      isOffline,
    };
  }
}