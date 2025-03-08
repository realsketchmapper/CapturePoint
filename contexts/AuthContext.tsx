import React, { createContext, useEffect, useState, useCallback, useContext } from 'react';
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

  // Check auth state when the app loads
  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        const userData = await AuthService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Auth state check failed:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initAuth();
  }, []);

  // Monitor network status changes
  useEffect(() => {
    // Skip if no user or already fully online
    if (!user || (user && !user.isOffline)) return;

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && user?.isOffline) {
        // We're back online and were in offline mode - validate token
        const isValid = await AuthService.validateToken();
        if (isValid && user) {
          // Update user to online mode
          setUser({
            ...user,
            isOffline: false
          });
        }
      }
    });

    return () => unsubscribe();
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
      isInitialized, // New property to indicate auth is fully initialized
      isOffline: user?.isOffline || false, // Expose offline state
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