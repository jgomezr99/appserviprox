import {
  api,
  ApiError,
  getApiBaseUrl,
  getConnectionMode,
  getLocalFallbackApiUrl,
  getSessionAuthMode,
  setSessionAuthMode,
  setWorkingBaseUrl,
  tokenStorage,
} from "./api";
import type {
  AuthTokenResponse,
  LoginPayload,
  ProfessionalCertificatePayload,
  RefreshTokenResponse,
  RegisterPayload,
  UpdateMePayload,
  User,
} from "../types/serviprox";

const LOCAL_ADMIN_ACCOUNTS_KEY = "serviprox_local_admin_accounts";

const readLocalAdminAccounts = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((x) => String(x).toLowerCase()) : [];
  } catch {
    return [];
  }
};

const rememberLocalAdminAccount = (username?: string, email?: string) => {
  if (typeof window === "undefined") return;
  try {
    const next = new Set(readLocalAdminAccounts());
    if (username?.trim()) next.add(username.trim().toLowerCase());
    if (email?.trim()) next.add(email.trim().toLowerCase());
    localStorage.setItem(LOCAL_ADMIN_ACCOUNTS_KEY, JSON.stringify(Array.from(next)));
  } catch {
    // ignore storage errors
  }
};

export const isRememberedLocalAdminAccount = (identifier?: string): boolean => {
  const clean = (identifier || "").trim().toLowerCase();
  if (!clean) return false;
  return readLocalAdminAccounts().includes(clean);
};

export type AdminWorkerRegistrationPayload = {
  worker_key: string;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  area: string;
  password: string;
};

export type RegisterWorkerResponse = {
  success: boolean;
  message: string;
  storage_mode?: "vm" | "local-sqlite";
  user: {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: string;
    is_staff: boolean;
    is_superuser?: boolean;
    area: string;
    phone?: string;
  };
};

const isAdminAccount = (u?: User | null): boolean =>
  Boolean(u && (u.role === "staff" || u.is_staff || u.is_superuser || (u.role as string) === "admin"));

export const authService = {
  login: async (
    payload: LoginPayload,
    options?: { allowLocalWorkerFallback?: boolean }
  ) => {
    try {
      const tokens = await api.post<AuthTokenResponse>("auth/token/", payload, {
        auth: false,
      });
      setSessionAuthMode(getConnectionMode() === "local-sqlite" ? "local-sqlite" : "vm");
      tokenStorage.setTokens(tokens.access, tokens.refresh);
      return tokens;
    } catch (err) {
      const identifier = (payload.username || payload.email || "").trim().toLowerCase();
      const shouldTryLocal =
        err instanceof ApiError &&
        [401, 403, 404].includes(err.status) &&
        (Boolean(options?.allowLocalWorkerFallback) || isRememberedLocalAdminAccount(identifier));

      const localBase = getLocalFallbackApiUrl();
      if (shouldTryLocal && localBase && getApiBaseUrl() !== localBase) {
        try {
          const res = await fetch(`${localBase}/auth/token/`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...payload,
              strict_password: true,
              require_admin: Boolean(options?.allowLocalWorkerFallback),
            }),
          });
          if (res.ok) {
            const tokens = (await res.json()) as AuthTokenResponse;
            setSessionAuthMode("local-sqlite");
            tokenStorage.setTokens(tokens.access, tokens.refresh);
            setWorkingBaseUrl(localBase, {
              database: "connected",
              engine: "sqlite",
              mode: "local-sqlite",
            });
            return tokens;
          }
        } catch {
          // Conservar el error original si el respaldo local tampoco autenticó
        }
      }

      throw err;
    }
  },

  loginWithUsername: async (username: string, password: string) => {
    const tokens = await api.post<AuthTokenResponse>(
      "auth/token/",
      { username, password },
      { auth: false }
    );
    tokenStorage.setTokens(tokens.access, tokens.refresh);
    return api.get<User>("auth/me/");
  },

  register: (payload: RegisterPayload) => {
    if (!payload.certificate) {
      return api.post<User>("auth/register/", payload, { auth: false });
    }
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, value instanceof File ? value : String(value));
      }
    });
    return api.post<User>("auth/register/", form, { auth: false });
  },

  requestPasswordReset: (emailOrUsername: string) =>
    api.post<{ detail: string }>(
      "auth/password-reset/request/",
      { email: emailOrUsername, username: emailOrUsername },
      { auth: false }
    ),

  confirmPasswordReset: (payload: {
    email: string;
    code: string;
    new_password: string;
  }) =>
    api.post<{ detail: string }>(
      "auth/password-reset/confirm/",
      { ...payload, username: payload.email },
      { auth: false }
    ),

  registerAdminWorker: async (
    payload: AdminWorkerRegistrationPayload
  ): Promise<RegisterWorkerResponse> => {
    const cleanPayload: AdminWorkerRegistrationPayload = {
      ...payload,
      username: payload.username.trim(),
      email: payload.email.trim().toLowerCase(),
      full_name: payload.full_name.trim(),
      area: payload.area.trim() || "Defensoría y Mesa Técnica",
      phone: payload.phone?.trim() || "",
    };

    const workerEndpoints = [
      "auth/admin/register-worker/",
      "admin/register-worker/",
      "auth/register-worker/",
    ];

    let lastNotFoundErr: unknown = null;
    for (const endpoint of workerEndpoints) {
      try {
        const res = await api.post<RegisterWorkerResponse>(endpoint, cleanPayload, {
          auth: false,
        });
        const mode = getConnectionMode();
        if (mode === "local-sqlite") {
          rememberLocalAdminAccount(res.user.username, res.user.email);
        }
        return {
          ...res,
          storage_mode: mode === "local-sqlite" ? "local-sqlite" : "vm",
        };
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
          lastNotFoundErr = err;
          continue;
        }
        throw err;
      }
    }

    // Si la MV actual aún no expone la ruta register-worker, pero hay sesión administrativa activa en la MV,
    // creamos la cuenta vía auth/register/ y la promovemos en la MV con admin/action/ (change_user_role).
    const activeToken = tokenStorage.getAccessToken();
    if (activeToken && getSessionAuthMode() !== "local-sqlite") {
      try {
        const currentAdmin = await api.get<User>("auth/me/", { retryOnUnauthorized: false });
        if (isAdminAccount(currentAdmin)) {
          const [firstName, ...rest] = cleanPayload.full_name.split(/\s+/);
          const created = await api.post<User>(
            "auth/register/",
            {
              email: cleanPayload.email,
              username: cleanPayload.username,
              first_name: firstName || cleanPayload.username,
              last_name: rest.join(" "),
              phone: cleanPayload.phone || "",
              city: "Bogotá",
              role: "client",
              password: cleanPayload.password,
            },
            { auth: false }
          );

          await api.post("admin/action/", {
            action: "change_user_role",
            target_id: created.id,
            user_id: created.id,
            new_role: "superadmin",
            reason: `Alta administrativa desde Chat Serviprox (${cleanPayload.area})`,
            admin_name:
              `${currentAdmin.first_name || ""} ${currentAdmin.last_name || ""}`.trim() ||
              currentAdmin.username,
          });

          return {
            success: true,
            message: "Cuenta administrativa creada y promovida directamente en la Máquina Virtual.",
            storage_mode: "vm",
            user: {
              id: created.id,
              username: created.username,
              email: created.email,
              full_name: cleanPayload.full_name,
              role: "staff",
              is_staff: true,
              is_superuser: true,
              area: cleanPayload.area,
              phone: cleanPayload.phone,
            },
          };
        }
      } catch (err) {
        // Si la validación del registro en MV falló (ej. contraseña < 8 caracteres o correo repetido), informar al usuario
        if (err instanceof ApiError && err.status === 400) {
          throw err;
        }
      }
    }

    // Si estamos sin sesión admin de MV y la MV devolvió 404, provisionar en el servidor local SQLite
    // y recordar la cuenta para que el login administrativo la autentique automáticamente.
    const localBase = getLocalFallbackApiUrl();
    if (localBase && getApiBaseUrl() !== localBase) {
      const response = await fetch(`${localBase}/auth/admin/register-worker/`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanPayload),
      });
      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        const msg =
          typeof body === "object" && body && "detail" in body
            ? String((body as { detail: unknown }).detail)
            : `API request failed with status ${response.status}`;
        throw new ApiError(response.status, msg, body);
      }
      const workerRes = body as RegisterWorkerResponse;
      rememberLocalAdminAccount(workerRes.user.username, workerRes.user.email);
      return {
        ...workerRes,
        storage_mode: "local-sqlite",
      };
    }

    throw (
      lastNotFoundErr ||
      new ApiError(404, "No existe una ruta disponible para registrar cuentas administrativas.", null)
    );
  },

  getCurrentUser: () => api.get<User>("auth/me/"),

  updateCurrentUser: (payload: UpdateMePayload) =>
    api.patch<User>("auth/me/", payload),

  deleteCurrentUser: (reason: string) =>
    api.delete<void>("auth/me/delete/", { reason }),

  becomeProfessional: (certificate?: ProfessionalCertificatePayload) => {
    if (!certificate) return api.post<User>("auth/become-professional/");
    const form = new FormData();
    form.append("profession", certificate.profession);
    form.append("certificate", certificate.file);
    return api.post<User>("auth/become-professional/", form);
  },

  becomeClient: () => api.post<User>("auth/become-client/"),

  completeOnboarding: () => api.post<User>("auth/onboarding/complete/"),

  refresh: async () => {
    const refresh = tokenStorage.getRefreshToken();
    if (!refresh) return null;

    const tokens = await api.post<RefreshTokenResponse>(
      "auth/token/refresh/",
      { refresh },
      { auth: false }
    );
    tokenStorage.setTokens(tokens.access, tokens.refresh);
    return tokens.access;
  },
};
