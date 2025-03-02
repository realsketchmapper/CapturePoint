import React, { createContext, useEffect, useState, useCallback, useContext} from 'react';
import { AuthService } from '@/services/auth/authService';
import { User, AuthContextState, AuthContextActions } from '@/types/auth.types';

type AuthContextType = AuthContextState & AuthContextActions;

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

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
      const userData = await AuthService.getCurrentUser();
      if (userData) {
        setUser(userData);
      }
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
      error,
      login,
      logout
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