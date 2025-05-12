import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AUTH_CONFIG } from './config';
import { AuthError, AuthErrorType } from './errors';

export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    console.log('Checking network connectivity...');
    const networkState = await Promise.race([
      NetInfo.fetch(),
      new Promise<NetInfoState>((resolve) =>
        setTimeout(
          () => {
            console.log('Network check timed out');
            resolve({ isConnected: false } as NetInfoState);
          },
          AUTH_CONFIG.NETWORK.CHECK_TIMEOUT
        )
      ),
    ]);

    const isConnected = !!networkState.isConnected;
    console.log(`Network connectivity check result: ${isConnected ? 'Connected' : 'Disconnected'}`);
    
    if (networkState.type) {
      console.log(`Network type: ${networkState.type}`);
    }

    return isConnected;
  } catch (error) {
    console.log('Error checking network connectivity:', error);
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
      console.log(`${context}: Attempt ${attempt + 1} of ${AUTH_CONFIG.RETRY.MAX_ATTEMPTS + 1}`);
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Log the error details
      if (error instanceof Error) {
        console.log(`${context}: Attempt ${attempt + 1} failed: ${error.message}`);
      } else {
        console.log(`${context}: Attempt ${attempt + 1} failed with unknown error`);
      }

      if (attempt === AUTH_CONFIG.RETRY.MAX_ATTEMPTS) {
        console.log(`${context}: Maximum retry attempts reached`);
        break;
      }

      const delay =
        AUTH_CONFIG.RETRY.DELAY *
        Math.pow(AUTH_CONFIG.RETRY.BACKOFF_FACTOR, attempt);

      console.log(`${context}: Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new AuthError(
    `Operation failed after ${AUTH_CONFIG.RETRY.MAX_ATTEMPTS} attempts: ${context}`,
    AuthErrorType.NETWORK_ERROR,
    lastError
  );
}; 