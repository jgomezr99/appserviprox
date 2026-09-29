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

const DEMO_SESSION_KEY = "serviprox_demo_user";
const DEMO_PASSWORD = "serviprox2026";

const demoUsers: Record<string, User> = {
  "laura.gomez@bogota.co": {
    id: 6,
    email: "laura.gomez@bogota.co",
    username: "laura.gomez",
    first_name: "Laura",
    last_name: "Gómez",
    role: "client",
    phone: "+57 310 445 8892",
    city: "Bogotá",
    document_id: "CC 52.894.120",
    address: "Cra. 11 # 85-32, Chicó, Bogotá",
    initials: "LG",
    is_identity_verified: true,
    onboarding_completed: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  "camila@demo.serviprox.co": {
    id: 9001,
    email: "camila@demo.serviprox.co",
    username: "camila",
    first_name: "Camila",
    last_name: "Rojas",
    role: "client",
    phone: "+57 315 220 1144",
    city: "Bogotá",
    document_id: "CC 1.018.490.123",
    address: "Calle 53 # 21-40, Galerías, Bogotá",
    initials: "CR",
    is_identity_verified: true,
    onboarding_completed: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  "andres.ruiz@demo.serviprox.co": {
    id: 9002,
    email: "andres.ruiz@demo.serviprox.co",
    username: "andres.ruiz",
    first_name: "Andrés",
    last_name: "Ruiz",
    role: "professional",
    phone: "+57 300 000 0000",
    city: "Bogotá",
    document_id: "CC 80.123.456",
    address: "Calle 127 # 15-45, Usaquén, Bogotá",
    initials: "AR",
    is_identity_verified: true,
    onboarding_completed: true,
    created_at: "2026-01-01T00:00:00Z",
  },
};

const getDemoUser = (payload: LoginPayload) => {
  const user = demoUsers[payload.email.trim().toLowerCase()];
  return user && payload.password === DEMO_PASSWORD ? user : null;
};

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  refreshSession: () => Promise<User | null>;
  updateMe: (payload: UpdateMePayload) => Promise<User>;
  becomeProfessional: () => Promise<User>;
  becomeClient: () => Promise<User>;
  completeOnboarding: () => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStorage.clear();
    localStorage.removeItem(DEMO_SESSION_KEY);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const demoSession = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoSession && demoUsers[demoSession]) {
      const currentUser = demoUsers[demoSession];
      setUser(currentUser);
      setIsLoading(false);
      return currentUser;
    }

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
    const demoUser = getDemoUser(payload);
    if (demoUser) {
      try {
        await authService.login(payload);
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        return currentUser;
      } catch (error) {
        console.warn("Autenticación con backend no disponible para demo, activando sesión demo local:", error);
        localStorage.setItem(DEMO_SESSION_KEY, demoUser.email);
        setUser(demoUser);
        return demoUser;
      }
    }

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

  const becomeProfessional = useCallback(async () => {
    const updatedUser = await authService.becomeProfessional();
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const becomeClient = useCallback(async () => {
    const updatedUser = await authService.becomeClient();
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
      becomeProfessional,
      becomeClient,
      completeOnboarding,
      logout,
      refreshSession,
    }),
    [becomeClient, becomeProfessional, completeOnboarding, isLoading, login, logout, refreshSession, register, updateMe, user]
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
