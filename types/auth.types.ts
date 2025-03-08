export interface User {
  id: number;
  email: string;
  isOffline: boolean;
}

export interface LoginResponse {
  token: string;
  user_id: number;
  message?: string;
}

export interface AuthContextState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean; // New property to track if auth process is complete
  isOffline: boolean; // New property to expose offline state at context level
  error: string | null;
}

export interface AuthContextActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthState: () => Promise<void>; // Added to allow explicit auth state refresh
}

export interface EmailInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
}

export interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
}

export interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
}

// New interfaces for token storage
export interface StoredCredentials {
  token: string;
  userId: string;
  email: string;
}