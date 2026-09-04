import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { tokenStorage } from "../services/api";
import { authService } from "../services/auth";
import type { LoginPayload, RegisterPayload, User } from "../types/serviprox";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  refreshSession: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const hasAccess = !!tokenStorage.getAccessToken();
    const hasRefresh = !!tokenStorage.getRefreshToken();

    if (!hasAccess && !hasRefresh) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    try {
      if (!hasAccess && hasRefresh) {
        await authService.refresh();
      }
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      logout();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const login = useCallback(async (payload: LoginPayload) => {
    await authService.login(payload);
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authService.register(payload);
    await authService.login({ email: payload.email, password: payload.password });
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const handleExpired = () => setUser(null);
    window.addEventListener("serviprox:auth-expired", handleExpired);
    return () => window.removeEventListener("serviprox:auth-expired", handleExpired);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refreshSession,
    }),
    [isLoading, login, logout, refreshSession, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};
