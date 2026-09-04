import { api, tokenStorage } from "./api";
import type {
  AuthTokenResponse,
  LoginPayload,
  RefreshTokenResponse,
  RegisterPayload,
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

  getCurrentUser: () => api.get<User>("auth/me/"),

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
