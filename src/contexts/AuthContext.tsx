import React, { createContext, useEffect, useReducer, useCallback, useContext, useRef } from 'react';
import { AuthService } from '@/services/auth/authService';
import { User, AuthContextState, AuthContextActions } from '@/types/auth.types';
import NetInfo from '@react-native-community/netinfo';

type AuthContextType = AuthContextState & AuthContextActions;

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define action types
type AuthAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_OFFLINE'; payload: boolean };

// Define initial state
const initialState: AuthContextState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isInitialized: false,
  isOffline: false,
  error: null
};

// Reducer function
function authReducer(state: AuthContextState, action: AuthAction): AuthContextState {
  switch (action.type) {
    case 'SET_USER':
      return { 
        ...state, 
        user: action.payload,
        isAuthenticated: !!action.payload,
        isOffline: action.payload?.isOffline || false
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    case 'SET_OFFLINE':
      return { 
        ...state, 
        isOffline: action.payload,
        user: state.user ? { ...state.user, isOffline: action.payload } : null
      };
    default:
      return state;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const initializationAttempted = useRef(false);
  const validationRetries = useRef(0);
  const MAX_VALIDATION_RETRIES = 3;

  // Check auth state when the app loads
  useEffect(() => {
    const initAuth = async () => {
      if (initializationAttempted.current) return;
      initializationAttempted.current = true;

      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const userData = await AuthService.getCurrentUser();
        dispatch({ type: 'SET_USER', payload: userData });
      } catch (error) {
        console.error('Auth state check failed:', error);
        dispatch({ type: 'SET_USER', payload: null });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_INITIALIZED', payload: true });
      }
    };

    initAuth();
  }, []);

  // Separate effect for network monitoring
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleNetworkChange = async (isConnected: boolean) => {
      if (isConnected && state.user?.isOffline) {
        // Clear any existing timeout
        if (timeoutId) clearTimeout(timeoutId);
        
        // Check if we've exceeded max retries
        if (validationRetries.current >= MAX_VALIDATION_RETRIES) {
          console.log('Max validation retries reached, staying in offline mode');
          return;
        }
        
        // Set a new timeout for validation
        timeoutId = setTimeout(async () => {
          try {
            validationRetries.current += 1;
            const isValid = await AuthService.validateToken();
            
            if (isValid && state.user) {
              dispatch({ type: 'SET_USER', payload: { ...state.user, isOffline: false } });
              validationRetries.current = 0; // Reset retries on success
            } else if (validationRetries.current >= MAX_VALIDATION_RETRIES) {
              console.log('Max validation retries reached, staying in offline mode');
            }
          } catch (error) {
            console.error('Token validation error:', error);
          }
        }, 2000); // Wait 2 seconds before attempting validation
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      handleNetworkChange(!!state.isConnected);
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []); // No dependencies to prevent unnecessary re-subscriptions

  const login = useCallback(async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      const userData = await AuthService.login(email, password);
      dispatch({ type: 'SET_USER', payload: userData });
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'string' 
          ? err 
          : 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw new Error(errorMessage);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  const logout = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await AuthService.logout();
      dispatch({ type: 'SET_USER', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  const checkAuthState = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const userData = await AuthService.getCurrentUser();
      dispatch({ type: 'SET_USER', payload: userData });
    } catch (error) {
      console.error('Auth state check failed:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      checkAuthState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};