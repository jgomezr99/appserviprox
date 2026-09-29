import { api, tokenStorage } from "./api";
import type {
  AuthTokenResponse,
  LoginPayload,
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

  register: (payload: RegisterPayload) =>
    api.post<User>("auth/register/", payload, { auth: false }),

  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>("auth/password-reset/request/", { email }, { auth: false }),

  confirmPasswordReset: (payload: {
    email: string;
    code: string;
    new_password: string;
  }) => api.post<{ detail: string }>("auth/password-reset/confirm/", payload, { auth: false }),

  getCurrentUser: () => api.get<User>("auth/me/"),

  updateCurrentUser: (payload: UpdateMePayload) =>
    api.patch<User>("auth/me/", payload),

  becomeProfessional: () => api.post<User>("auth/become-professional/"),

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
