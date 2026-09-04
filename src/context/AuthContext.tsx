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
import type { LoginPayload, RegisterPayload, UpdateMePayload, User } from "../types/serviprox";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  refreshSession: () => Promise<User | null>;
  updateMe: (payload: UpdateMePayload) => Promise<User>;
  completeOnboarding: () => Promise<User>;
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

  const updateMe = useCallback(async (payload: UpdateMePayload) => {
    const updatedUser = await authService.updateCurrentUser(payload);
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const completeOnboarding = useCallback(async () => {
    const updatedUser = await authService.completeOnboarding();
    setUser(updatedUser);
    return updatedUser;
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
      updateMe,
      completeOnboarding,
      logout,
      refreshSession,
    }),
    [completeOnboarding, isLoading, login, logout, refreshSession, register, updateMe, user]
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
