import React, { createContext, useEffect, useState, useCallback, useContext, useRef } from 'react';
import { AuthService } from '@/services/auth/authService';
import { User, AuthContextState, AuthContextActions } from '@/types/auth.types';
import NetInfo from '@react-native-community/netinfo';

type AuthContextType = AuthContextState & AuthContextActions;

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationAttempted = useRef(false);
  const isInitialAuthComplete = useRef(false);

  // Check auth state when the app loads
  useEffect(() => {
    const initAuth = async () => {
      if (initializationAttempted.current) return;
      initializationAttempted.current = true;

      try {
        setIsLoading(true);
        const userData = await AuthService.getCurrentUser();
        // Combine state updates into a single batch
        setUser(userData);
        setIsInitialized(true);
        isInitialAuthComplete.current = true;
      } catch (error) {
        console.error('Auth state check failed:', error);
        setUser(null);
        setIsInitialized(true);
        isInitialAuthComplete.current = true;
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Monitor network status changes with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Skip if initial auth isn't complete or no user
    if (!isInitialAuthComplete.current || !user) return;
    
    // Skip if user is already online
    if (!user.isOffline) return;

    const handleNetworkChange = async (isConnected: boolean) => {
      if (isConnected && user.isOffline) {
        // Clear any existing timeout
        if (timeoutId) clearTimeout(timeoutId);
        
        // Set a new timeout for validation
        timeoutId = setTimeout(async () => {
          const isValid = await AuthService.validateToken();
          if (isValid && user) {
            setUser({
              ...user,
              isOffline: false
            });
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
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const userData = await AuthService.login(email, password);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await AuthService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const checkAuthState = useCallback(async () => {
    try {
      setIsLoading(true);
      const userData = await AuthService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Auth state check failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      isInitialized,
      isOffline: user?.isOffline || false,
      error,
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