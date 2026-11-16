import { api, tokenStorage } from "./api";
import type {
  AuthTokenResponse,
  LoginPayload,
  ProfessionalCertificatePayload,
  RefreshTokenResponse,
  RegisterPayload,
  UpdateMePayload,
  User,
} from "../types/serviprox";

export const authService = {
  login: async (payload: LoginPayload) => {
    const tokens = await api.post<AuthTokenResponse>("auth/token/", payload, {
      auth: false,
    });
    tokenStorage.setTokens(tokens.access, tokens.refresh);
    return tokens;
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

  registerAdminWorker: async (payload: {
    worker_key: string;
    username: string;
    full_name: string;
    email: string;
    phone?: string;
    area: string;
    password: string;
  }) => {
    type RegisterWorkerResponse = {
      success: boolean;
      message: string;
      user: {
        id: number;
        username: string;
        email: string;
        full_name: string;
        role: string;
        is_staff: boolean;
        area: string;
        phone?: string;
      };
    };

    try {
      return await api.post<RegisterWorkerResponse>("auth/admin/register-worker/", payload, { auth: false });
    } catch (err: any) {
      if (err?.status === 404) {
        try {
          return await api.post<RegisterWorkerResponse>("admin/register-worker/", payload, { auth: false });
        } catch {
          return await api.post<RegisterWorkerResponse>("auth/register-worker/", payload, { auth: false });
        }
      }
      throw err;
    }
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
