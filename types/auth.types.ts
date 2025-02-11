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
    error: string | null;
  }
  
  export interface AuthContextActions {
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
  }