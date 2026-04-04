import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { api } from '../lib/api';
import type { User } from '../types';
import {
  clearAuthSession,
  getStoredToken,
  getStoredUser,
  saveAuthSession
} from '../utils/storage';

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setToken(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const storedToken = getStoredToken();

    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.getProfile();
      setUser(response.data);
      setToken(storedToken);
      saveAuthSession(storedToken, response.data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    saveAuthSession(response.data.token, response.data.user);
    setToken(response.data.token);
    setUser(response.data.user);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshProfile
    }),
    [user, token, loading, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}