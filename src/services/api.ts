import { Capacitor } from "@capacitor/core";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  token?: string | null;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
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

const resolveApiBaseUrl = (): string => {
  // 1. Configuración explícita en variable de entorno
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }

  // 2. Anulación manual en localStorage si se requiere conectar a un servidor específico
  if (typeof window !== "undefined") {
    const customHost = localStorage.getItem("serviprox_api_host");
    if (customHost) {
      return `${customHost.replace(/\/$/, "")}/api/v1`;
    }
  }

  // 3. Dispositivo nativo compilado con Capacitor (Emulador o App instalada)
  if (Capacitor.isNativePlatform()) {
    const saved = typeof window !== "undefined" ? localStorage.getItem("serviprox_api_host") : null;
    if (saved) {
      return `${saved.replace(/\/$/, "")}/api/v1`;
    }
    // Celular físico conectado por Wi-Fi usa la IP local del servidor (192.168.0.6)
    return "http://192.168.0.6:8000/api/v1";
  }

  // 4. Navegador Web y Móvil (DevTunnels, Red Local, Localhost)
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, "")}/api/v1`;
  }

  return "/api/v1";
};

// Base URL dinámica y reactiva
let activeBaseUrl = resolveApiBaseUrl();
export let API_BASE_URL = activeBaseUrl;

export const getApiBaseUrl = (): string => activeBaseUrl;

export const getCandidateBaseUrls = (): string[] => {
  const candidates: string[] = [activeBaseUrl];

  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      // Fallbacks directos a Django para saltarse posibles fallos de proxy de Vite
      candidates.push("http://127.0.0.1:8000/api/v1");
      candidates.push("http://localhost:8000/api/v1");
    } else if (hostname && !hostname.includes("devtunnels.ms")) {
      candidates.push(`http://${hostname}:8000/api/v1`);
    }

    // Proxy relativo por si se sirve en port 8100
    if (window.location.origin) {
      candidates.push(`${window.location.origin.replace(/\/$/, "")}/api/v1`);
    }
  }

  if (Capacitor.isNativePlatform()) {
    candidates.push("http://192.168.0.6:8000/api/v1");
    candidates.push("http://10.0.2.2:8000/api/v1");
    candidates.push("http://localhost:8000/api/v1");
  }

  // Eliminar duplicados manteniendo orden de prioridad
  return Array.from(new Set(candidates.filter(Boolean)));
};

export const setWorkingBaseUrl = (url: string) => {
  activeBaseUrl = url.replace(/\/$/, "");
  API_BASE_URL = activeBaseUrl;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("serviprox_api_host", activeBaseUrl.replace(/\/api\/v1$/, ""));
    } catch {
      // Ignorar restricciones de almacenamiento
    }
    window.dispatchEvent(
      new CustomEvent("serviprox:connection-status", {
        detail: { connected: true, url: activeBaseUrl },
      })
    );
  }
};

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

const buildUrlForBase = (
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
) => {
  let fullUrl = /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl}/${path.replace(/^\//, "")}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.set(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
    }
  }
  return fullUrl;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isGatewayOrNetworkError = (status?: number): boolean => {
  return !status || status === 502 || status === 503 || status === 504;
};

/**
 * Ejecuta una petición HTTP con reintentos y tolerancia a fallos.
 * Si el proxy de Vite o el host actual devuelve 502/503/504 o falla la red,
 * intenta automáticamente los otros endpoints candidatos (ej. conexión directa a Django :8000).
 */
async function fetchWithResilience(
  path: string,
  init: RequestInit,
  params?: Record<string, string | number | boolean | undefined | null>,
  maxRounds = 2
): Promise<Response> {
  const candidates = getCandidateBaseUrls();
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (let round = 0; round < maxRounds; round++) {
    for (const base of candidates) {
      const url = buildUrlForBase(base, path, params);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
          ...init,
          signal: init.signal || controller.signal,
        });
        clearTimeout(timeoutId);

        // Si el estado no es error de puerta de enlace (502/503/504), el backend respondió correctamente
        if (!isGatewayOrNetworkError(response.status)) {
          if (base !== activeBaseUrl) {
            setWorkingBaseUrl(base);
          }
          return response;
        }

        lastResponse = response;
      } catch (err) {
        lastError = err;
      }

      // Pequeña pausa antes de intentar el siguiente candidato
      await sleep(150);
    }

    // Espera incremental entre rondas completas de reintentos
    if (round < maxRounds - 1) {
      await sleep(600);
    }
  }

  // Notificar desconexión
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("serviprox:connection-status", {
        detail: { connected: false },
      })
    );
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw (
    lastError ||
    new ApiError(
      503,
      "No pudimos conectar con el backend de Serviprox. Verifica que esté iniciado en el puerto 8000 (iniciar_serviprox.bat o backend\\start_local.bat).",
      null
    )
  );
}

const refreshAccessToken = async () => {
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) return null;

  try {
    const response = await fetchWithResilience(
      "auth/token/refresh/",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh }),
      },
      undefined,
      1
    );

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
  } catch {
    return null;
  }
};

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const shouldAttachAuth = options.auth !== false;
  const token =
    options.token ?? (shouldAttachAuth ? tokenStorage.getAccessToken() : null);

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

  const response = await fetchWithResilience(path, init, options.params);
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
    throw new ApiError(
      response.status,
      getErrorMessage(response.status, payload),
      payload
    );
  }

  return payload as T;
}

async function blobRequest(
  path: string,
  options: RequestOptions = {}
): Promise<Blob> {
  const shouldAttachAuth = options.auth !== false;
  const token =
    options.token ?? (shouldAttachAuth ? tokenStorage.getAccessToken() : null);
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetchWithResilience(
    path,
    { method: "GET", headers },
    options.params
  );

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
    throw new ApiError(
      response.status,
      getErrorMessage(response.status, payload),
      payload
    );
  }

  return response.blob();
}

/**
 * Comprueba el estado de la base de datos y la API de Serviprox.
 */
export const checkBackendHealth = async (): Promise<{
  ok: boolean;
  database: string;
  url?: string;
  error?: string;
}> => {
  const candidates = getCandidateBaseUrls();
  for (const base of candidates) {
    try {
      const url = `${base.replace(/\/$/, "")}/health/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setWorkingBaseUrl(base);
        return {
          ok: true,
          database: data.database || "connected",
          url: base,
        };
      }
    } catch {
      // Intentar con el siguiente candidato
    }
  }

  return {
    ok: false,
    database: "disconnected",
    error: "Backend no responde en el puerto 8000",
  };
};

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("DELETE", path, body, options),
  blob: (path: string, options?: RequestOptions) => blobRequest(path, options),
  checkHealth: checkBackendHealth,
};
