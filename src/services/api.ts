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

export const normalizeApiUrl = (url: string): string => {
  const clean = url.trim().replace(/\/$/, "");
  return clean.endsWith("/api/v1") ? clean : `${clean}/api/v1`;
};

export const getSavedCustomHost = (): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("serviprox_api_host") || "";
  }
  return "";
};

const resolveApiBaseUrl = (): string => {
  // 1. Configuración explícita en variable de entorno
  if (import.meta.env.VITE_API_URL) {
    return normalizeApiUrl(import.meta.env.VITE_API_URL);
  }

  // 2. Anulación manual en localStorage si se requiere conectar a un servidor específico
  const customHost = getSavedCustomHost();
  if (customHost) {
    return normalizeApiUrl(customHost);
  }

  // 3. Dispositivo nativo compilado con Capacitor (Emulador o App instalada)
  if (Capacitor.isNativePlatform()) {
    // Celular físico conectado por Wi-Fi usa la IP local del servidor (192.168.0.6)
    return "http://192.168.0.6:8000/api/v1";
  }

  // 4. Navegador Web y Móvil (DevTunnels, Red Local, Localhost)
  if (typeof window !== "undefined" && window.location?.origin) {
    // En Netlify estático, window.location.origin no ejecuta Python
    if (window.location.hostname.includes("netlify.app")) {
      return "/api/v1";
    }
    return `${window.location.origin.replace(/\/$/, "")}/api/v1`;
  }

  return "/api/v1";
};

// Base URL dinámica y reactiva
let activeBaseUrl = resolveApiBaseUrl();
export let API_BASE_URL = activeBaseUrl;

export const getApiBaseUrl = (): string => activeBaseUrl;

export const getCandidateBaseUrls = (): string[] => {
  const candidates: string[] = [];

  const saved = getSavedCustomHost();
  if (saved) {
    candidates.push(normalizeApiUrl(saved));
  }

  if (import.meta.env.VITE_API_URL) {
    candidates.push(normalizeApiUrl(import.meta.env.VITE_API_URL));
  }

  if (activeBaseUrl && activeBaseUrl !== "/api/v1") {
    candidates.push(activeBaseUrl);
  }

  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    const isNetlify = hostname.includes("netlify.app");

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      // Fallbacks directos a Django para saltarse posibles fallos de proxy de Vite
      candidates.push("http://127.0.0.1:8000/api/v1");
      candidates.push("http://localhost:8000/api/v1");
    } else if (hostname && !hostname.includes("devtunnels.ms") && !isNetlify) {
      candidates.push(`http://${hostname}:8000/api/v1`);
    }

    // Proxy relativo solo si no estamos en Netlify estático sin backend
    if (window.location.origin && !isNetlify) {
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
  activeBaseUrl = normalizeApiUrl(url);
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

  const text = await response.text();
  if (contentType.includes("text/html")) {
    throw new ApiError(
      503,
      "El host devolvió una página web (HTML) en lugar de datos JSON de Django. Verifica la URL del backend.",
      text
    );
  }

  return text;
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

        // Si el estado no es error de puerta de enlace (502/503/504)
        if (!isGatewayOrNetworkError(response.status)) {
          const contentType = response.headers.get("content-type") || "";
          // Si el servidor respondió con HTML (ej. index.html de Netlify por rewrite de SPA),
          // NO es una respuesta válida de la API de Django!
          if (contentType.includes("text/html")) {
            lastError = new ApiError(
              503,
              `El host (${base}) respondió con HTML en lugar de datos JSON de Django.`,
              null
            );
            continue;
          }

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
export const checkBackendHealth = async (
  customCandidate?: string
): Promise<{
  ok: boolean;
  database: string;
  url?: string;
  engine?: string;
  error?: string;
}> => {
  const candidates = customCandidate
    ? [normalizeApiUrl(customCandidate)]
    : getCandidateBaseUrls();

  if (candidates.length === 0) {
    return {
      ok: false,
      database: "disconnected",
      error: "No hay servidores backend configurados. En Netlify debes configurar VITE_API_URL o la URL del backend.",
    };
  }

  for (const base of candidates) {
    try {
      const url = `${base.replace(/\/$/, "")}/health/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        setWorkingBaseUrl(base);
        return {
          ok: true,
          database: data.database || "connected",
          engine: data.engine || "sqlite",
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
    error: "No pudimos conectar con el backend o la base de datos.",
  };
};

/**
 * Guarda y prueba una URL personalizada para el backend (ej: Render, DevTunnel, o IP local).
 */
export const saveCustomApiHost = async (
  host: string
): Promise<{ ok: boolean; message: string; database?: string; engine?: string; url?: string }> => {
  if (!host.trim()) {
    clearCustomApiHost();
    return { ok: true, message: "Se restauró la configuración por defecto." };
  }

  const normalized = normalizeApiUrl(host);
  const health = await checkBackendHealth(normalized);
  if (health.ok) {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("serviprox_api_host", host.trim());
      } catch {
        // ignore
      }
    }
    setWorkingBaseUrl(normalized);
    return {
      ok: true,
      message: `¡Conexión exitosa! Base de datos: ${health.database} (${health.engine || "sqlite"}).`,
      database: health.database,
      engine: health.engine,
      url: normalized,
    };
  }

  return {
    ok: false,
    message: health.error || "No se pudo verificar la conexión con este servidor.",
  };
};

/**
 * Limpia la URL personalizada de localStorage y restaura el valor por defecto.
 */
export const clearCustomApiHost = () => {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("serviprox_api_host");
    } catch {
      // ignore
    }
  }
  activeBaseUrl = resolveApiBaseUrl();
  API_BASE_URL = activeBaseUrl;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("serviprox:connection-status", {
        detail: { connected: false, url: activeBaseUrl },
      })
    );
  }
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
  saveCustomHost: saveCustomApiHost,
  clearCustomHost: clearCustomApiHost,
};
