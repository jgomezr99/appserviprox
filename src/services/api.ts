type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  token?: string | null;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const DEFAULT_API_URL = "http://localhost:8000/api/v1";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || DEFAULT_API_URL
).replace(/\/$/, "");

export const ACCESS_TOKEN_KEY = "serviprox_access_token";
export const REFRESH_TOKEN_KEY = "serviprox_refresh_token";

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    }
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

const buildUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}/${path.replace(/^\//, "")}`;
};

const parseResponse = async (response: Response) => {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

const getErrorMessage = (status: number, payload: unknown) => {
  if (typeof payload === "object" && payload && "detail" in payload) {
    return String((payload as { detail: unknown }).detail);
  }
  if (typeof payload === "object" && payload && "non_field_errors" in payload) {
    const errors = (payload as { non_field_errors: unknown }).non_field_errors;
    return Array.isArray(errors) ? String(errors[0]) : String(errors);
  }
  return `API request failed with status ${status}`;
};

const refreshAccessToken = async () => {
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) return null;

  const response = await fetch(buildUrl("auth/token/refresh/"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    tokenStorage.clear();
    window.dispatchEvent(new Event("serviprox:auth-expired"));
    return null;
  }

  const tokens = payload as { access?: string; refresh?: string };
  if (!tokens.access) return null;

  tokenStorage.setTokens(tokens.access, tokens.refresh);
  return tokens.access;
};

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const shouldAttachAuth = options.auth !== false;
  const token = options.token ?? (shouldAttachAuth ? tokenStorage.getAccessToken() : null);

  const headers = new Headers();
  headers.set("Accept", "application/json");

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(body);
    }
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), init);
  const payload = await parseResponse(response);

  if (
    response.status === 401 &&
    shouldAttachAuth &&
    options.retryOnUnauthorized !== false
  ) {
    const nextAccess = await refreshAccessToken();
    if (nextAccess) {
      return request<T>(method, path, body, {
        ...options,
        token: nextAccess,
        retryOnUnauthorized: false,
      });
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, getErrorMessage(response.status, payload), payload);
  }

  return payload as T;
}

async function blobRequest(
  path: string,
  options: RequestOptions = {}
): Promise<Blob> {
  const shouldAttachAuth = options.auth !== false;
  const token = options.token ?? (shouldAttachAuth ? tokenStorage.getAccessToken() : null);
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), { method: "GET", headers });
  if (
    response.status === 401 &&
    shouldAttachAuth &&
    options.retryOnUnauthorized !== false
  ) {
    const nextAccess = await refreshAccessToken();
    if (nextAccess) {
      return blobRequest(path, {
        ...options,
        token: nextAccess,
        retryOnUnauthorized: false,
      });
    }
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new ApiError(response.status, getErrorMessage(response.status, payload), payload);
  }

  return response.blob();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
  blob: (path: string, options?: RequestOptions) => blobRequest(path, options),
};
