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
      // Check network connectivity first
      const isConnected = await checkNetworkConnectivity();

      if (!isConnected) {
        return this.attemptOfflineLogin();
      }

      // Only clear credentials for online login
      await tokenStorage.clearCredentials();

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
        'No stored credentials found. You need to login online at least once before using offline mode.',
        AuthErrorType.NO_CREDENTIALS
      );
    }

    console.log('Offline login successful with stored credentials');
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
        console.log('No stored credentials found during getCurrentUser');
        return null;
      }

      const isConnected = await checkNetworkConnectivity();

      if (!isConnected) {
        console.log('Device is offline, returning offline user from stored credentials');
        return this.createUserFromCredentials(credentials, true);
      }

      try {
        console.log('Attempting to validate token with server');
        const isValid = await this.validateToken(true);

        if (!isValid) {
          console.log('Token validation failed, returning offline user');
          return this.createUserFromCredentials(credentials, true);
        }

        console.log('Token validation successful, returning online user');
        return this.createUserFromCredentials(credentials, false);
      } catch (error) {
        console.log('Error during token validation, returning offline user', error);
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
        console.log('No token found during validateToken');
        return false;
      }

      const isConnected = await checkNetworkConnectivity();

      if (!isConnected) {
        console.log('Device is offline, skipping token validation');
        return false;
      }

      console.log(`Validating token (${isInitialValidation ? 'initial' : 'regular'} validation)`);
      return await withRetry(
        async () => {
          try {
            await api.get(API_ENDPOINTS.VALIDATE_TOKEN, {
              timeout: isInitialValidation
                ? AUTH_CONFIG.NETWORK.INITIAL_VALIDATION_TIMEOUT
                : AUTH_CONFIG.NETWORK.TIMEOUT,
            } as ExtendedAxiosRequestConfig);
            console.log('Token validation successful');
            return true;
          } catch (error) {
            console.log('Token validation request failed:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
          }
        },
        'validateToken'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Token validation failed: ${errorMessage}`);
      
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