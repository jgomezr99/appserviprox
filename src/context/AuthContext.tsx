import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { tokenStorage, ApiError } from "../services/api";
import { authService } from "../services/auth";
import type { LoginPayload, RegisterPayload, UpdateMePayload, User } from "../types/serviprox";

const DEMO_SESSION_KEY = "serviprox_demo_user";
const CACHED_USER_KEY = "serviprox_cached_user";
const DEMO_PASSWORDS = ["serviprox2026", "servipro2026"];

const getCachedUser = (): User | null => {
  try {
    const demo = localStorage.getItem(DEMO_SESSION_KEY);
    if (demo && demoUsers[demo]) return demoUsers[demo];
    const cached = localStorage.getItem(CACHED_USER_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
};

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
  "admin@serviprox.com": {
    id: 9999,
    email: "admin@serviprox.com",
    username: "admin",
    first_name: "Administrador",
    last_name: "Serviprox",
    role: "staff",
    is_staff: true,
    is_superuser: true,
    phone: "+57 300 123 4567",
    city: "Bogotá",
    document_id: "CC 1.000.000.001",
    address: "Oficinas Serviprox Bogotá",
    initials: "AD",
    is_identity_verified: true,
    onboarding_completed: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  "admin": {
    id: 9999,
    email: "admin@serviprox.com",
    username: "admin",
    first_name: "Administrador",
    last_name: "Serviprox",
    role: "staff",
    is_staff: true,
    is_superuser: true,
    phone: "+57 300 123 4567",
    city: "Bogotá",
    document_id: "CC 1.000.000.001",
    address: "Oficinas Serviprox Bogotá",
    initials: "AD",
    is_identity_verified: true,
    onboarding_completed: true,
    created_at: "2026-01-01T00:00:00Z",
  },
};

const getDemoUser = (payload: LoginPayload) => {
  const key = payload.email.trim().toLowerCase();
  const user = demoUsers[key];
  const validPassword = DEMO_PASSWORDS.includes(payload.password);
  return user && validPassword ? user : null;
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
  becomeStaff: () => Promise<User>;
  completeOnboarding: () => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = getCachedUser();
    if (cached) return false;
    return !!tokenStorage.getAccessToken() || !!tokenStorage.getRefreshToken();
  });

  const saveUser = useCallback((u: User | null) => {
    setUser(u);
    try {
      if (u) {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(CACHED_USER_KEY);
      }
    } catch {}
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    localStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(CACHED_USER_KEY);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const demoSession = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoSession && demoUsers[demoSession]) {
      const currentUser = demoUsers[demoSession];
      saveUser(currentUser);
      setIsLoading(false);
      return currentUser;
    }

    const hasAccess = !!tokenStorage.getAccessToken();
    const hasRefresh = !!tokenStorage.getRefreshToken();

    if (!hasAccess && !hasRefresh) {
      saveUser(null);
      setIsLoading(false);
      return null;
    }

    const cached = getCachedUser();
    if (!cached) {
      setIsLoading(true);
    }
    try {
      if (!hasAccess && hasRefresh) {
        await authService.refresh();
      }
      const currentUser = await authService.getCurrentUser();
      saveUser(currentUser);
      return currentUser;
    } catch (err) {
      // Si el token fue rechazado expresamente con 401, cerramos sesión
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return null;
      }
      // Si el backend está iniciando, sin conexión o responde lento, mantenemos la sesión en caché
      if (cached) {
        console.warn("Backend no disponible de inmediato, conservando sesión local:", err);
        return cached;
      }
      logout();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [logout, saveUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const demoUser = getDemoUser(payload);
    if (demoUser) {
      try {
        await authService.login(payload);
        const currentUser = await authService.getCurrentUser();
        saveUser(currentUser);
        return currentUser;
      } catch (error) {
        console.warn("Autenticación con backend no disponible para demo, activando sesión demo local:", error);
        localStorage.setItem(DEMO_SESSION_KEY, demoUser.email);
        saveUser(demoUser);
        return demoUser;
      }
    }

    await authService.login(payload);
    const currentUser = await authService.getCurrentUser();
    saveUser(currentUser);
    return currentUser;
  }, [saveUser]);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authService.register(payload);
    await authService.login({ email: payload.email, password: payload.password });
    const currentUser = await authService.getCurrentUser();
    saveUser(currentUser);
    return currentUser;
  }, [saveUser]);

  const updateMe = useCallback(async (payload: UpdateMePayload) => {
    const updatedUser = await authService.updateCurrentUser(payload);
    saveUser(updatedUser);
    return updatedUser;
  }, [saveUser]);

  const completeOnboarding = useCallback(async () => {
    const updatedUser = await authService.completeOnboarding();
    saveUser(updatedUser);
    return updatedUser;
  }, [saveUser]);

  const becomeProfessional = useCallback(async () => {
    const updatedUser = await authService.becomeProfessional();
    saveUser(updatedUser);
    return updatedUser;
  }, [saveUser]);

  const becomeClient = useCallback(async () => {
    const updatedUser = await authService.becomeClient();
    saveUser(updatedUser);
    return updatedUser;
  }, [saveUser]);

  const becomeStaff = useCallback(async () => {
    const adminUser = demoUsers["admin@serviprox.com"] || {
      id: 9999,
      email: "admin@serviprox.com",
      username: "admin",
      first_name: "Administrador",
      last_name: "Serviprox",
      role: "staff",
      is_staff: true,
      is_superuser: true,
      phone: "+57 300 123 4567",
      city: "Bogotá",
      document_id: "CC 1.000.000.001",
      address: "Oficinas Serviprox Bogotá",
      initials: "AD",
      is_identity_verified: true,
      onboarding_completed: true,
      created_at: "2026-01-01T00:00:00Z",
    };
    try {
      localStorage.setItem(DEMO_SESSION_KEY, "admin@serviprox.com");
    } catch {}
    saveUser(adminUser);
    return adminUser;
  }, [saveUser]);

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
      becomeStaff,
      completeOnboarding,
      logout,
      refreshSession,
    }),
    [becomeClient, becomeProfessional, becomeStaff, completeOnboarding, isLoading, login, logout, refreshSession, register, updateMe, user]
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
