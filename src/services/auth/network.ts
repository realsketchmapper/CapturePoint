import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AUTH_CONFIG } from './config';
import { AuthError, AuthErrorType } from './errors';

export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    const networkState = await Promise.race([
      NetInfo.fetch(),
      new Promise<NetInfoState>((resolve) =>
        setTimeout(
          () => resolve({ isConnected: false } as NetInfoState),
          AUTH_CONFIG.NETWORK.CHECK_TIMEOUT
        )
      ),
    ]);

    return !!networkState.isConnected;
  } catch (error) {
    throw new AuthError(
      'Failed to check network connectivity',
      AuthErrorType.NETWORK_ERROR,
      error instanceof Error ? error : undefined
    );
  }
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= AUTH_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === AUTH_CONFIG.RETRY.MAX_ATTEMPTS) {
        break;
      }

      const delay =
        AUTH_CONFIG.RETRY.DELAY *
        Math.pow(AUTH_CONFIG.RETRY.BACKOFF_FACTOR, attempt);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new AuthError(
    `Operation failed after ${AUTH_CONFIG.RETRY.MAX_ATTEMPTS} attempts: ${context}`,
    AuthErrorType.NETWORK_ERROR,
    lastError
  );
}; 