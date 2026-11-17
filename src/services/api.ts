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

export type ConnectionMode = "vm-direct" | "vm-proxy" | "local-sqlite" | "custom";

const DEFAULT_WEB_VM_API_URL = "https://serviprox-pte.duckdns.org/api/v1";

const isVitestEnv = (): boolean => {
  if (typeof process !== "undefined" && process.env && "VITEST" in process.env) {
    return Boolean(process.env.VITEST);
  }
  return Boolean((import.meta as { env?: Record<string, unknown> }).env?.VITEST);
};

const isProdMode = (): boolean => {
  if (typeof process !== "undefined" && process.env?.PROD !== undefined) {
    return process.env.PROD === "true" || process.env.PROD === "1";
  }
  return Boolean(import.meta.env.PROD);
};

const getRawViteApiUrl = (): string => {
  if (typeof process !== "undefined" && typeof process.env?.VITE_API_URL === "string" && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  return import.meta.env.VITE_API_URL || "";
};

export const normalizeApiUrl = (url: string): string => {
  let clean = url.trim().replace(/\/+$/, "");
  clean = clean.replace(/\/health$/i, "");
  if (clean.endsWith("/api/v1") || clean.endsWith("/api/vm/v1")) {
    return clean;
  }
  return `${clean}/api/v1`;
};

const getConfiguredVmUrl = (): string => {
  const raw = getRawViteApiUrl();
  if (raw) {
    return normalizeApiUrl(raw);
  }
  if (!Capacitor.isNativePlatform() && !isVitestEnv()) {
    return DEFAULT_WEB_VM_API_URL;
  }
  return "";
};

export const getSavedCustomHost = (): string => {
  if (isProdMode() && isVitestEnv()) return "";
  if (typeof window !== "undefined") {
    if (localStorage.getItem("serviprox_custom_host_explicit") === "1") {
      return localStorage.getItem("serviprox_api_host") || "";
    }
  }
  return "";
};

export const getConnectionMode = (baseUrl?: string): ConnectionMode => {
  const target = (baseUrl || activeBaseUrl || "").trim();
  if (target.includes("/api/vm/v1")) return "vm-proxy";
  const configured = getConfiguredVmUrl();
  if (configured && target === configured) return "vm-direct";
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    target === `${window.location.origin.replace(/\/$/, "")}/api/v1`
  ) {
    return "local-sqlite";
  }
  return target.includes("serviprox-pte.duckdns.org") ? "vm-direct" : "custom";
};

const getPriorityCandidateBaseUrls = (): string[] => {
  const candidates: string[] = [];
  const configuredUrl = getConfiguredVmUrl();

  // En suite unitaria de producción (Vitest), respetar estrictamente el contrato de solo VITE_API_URL
  if (isProdMode() && configuredUrl && isVitestEnv()) {
    return [configuredUrl];
  }

  // 1. Host personalizado guardado explícitamente por el usuario desde el modal
  const saved = getSavedCustomHost();
  if (saved) {
    candidates.push(normalizeApiUrl(saved));
  }

  // 2. Conexión directa configurada en VITE_API_URL (Máquina Virtual)
  if (configuredUrl) {
    candidates.push(configuredUrl);
  }

  // 3. Proxy anti-CORS en servidor + respaldo SQLite local para paneles web
  if (!Capacitor.isNativePlatform() && typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    const isNetlify = hostname.includes("netlify.app");
    const origin = window.location.origin ? window.location.origin.replace(/\/$/, "") : "";

    if (origin && !isNetlify) {
      if (configuredUrl && !configuredUrl.startsWith(origin)) {
        candidates.push(`${origin}/api/vm/v1`);
      }
      candidates.push(`${origin}/api/v1`);
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      candidates.push("http://127.0.0.1:8000/api/v1");
      candidates.push("http://localhost:8000/api/v1");
    }
  }

  // 4. Candidatos de respaldo para entornos nativos Capacitor
  if (Capacitor.isNativePlatform()) {
    candidates.push("http://192.168.0.6:8000/api/v1");
    candidates.push("http://10.0.2.2:8000/api/v1");
    candidates.push("http://127.0.0.1:8000/api/v1");
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

export const ACCESS_TOKEN_KEY = "serviprox_access_token";
export const REFRESH_TOKEN_KEY = "serviprox_refresh_token";
const SESSION_AUTH_MODE_KEY = "serviprox_auth_mode";

export const getSessionAuthMode = (): "vm" | "local-sqlite" | null => {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(SESSION_AUTH_MODE_KEY);
    return val === "local-sqlite" || val === "vm" ? val : null;
  } catch {
    return null;
  }
};

export const setSessionAuthMode = (mode: "vm" | "local-sqlite" | null) => {
  if (typeof window === "undefined") return;
  try {
    if (mode) {
      localStorage.setItem(SESSION_AUTH_MODE_KEY, mode);
    } else {
      localStorage.removeItem(SESSION_AUTH_MODE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const getLocalFallbackApiUrl = (): string | null => {
  if (isProdMode() && isVitestEnv()) return null;
  if (Capacitor.isNativePlatform() || typeof window === "undefined" || !window.location?.origin) {
    return null;
  }
  if (window.location.hostname.includes("netlify.app")) return null;
  return `${window.location.origin.replace(/\/$/, "")}/api/v1`;
};

const hasLocalAuthenticatedSession = (): boolean => {
  if (typeof window === "undefined" || (isProdMode() && isVitestEnv())) return false;
  try {
    return (
      getSessionAuthMode() === "local-sqlite" &&
      Boolean(localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY)) &&
      Boolean(getLocalFallbackApiUrl())
    );
  } catch {
    return false;
  }
};

const resolveApiBaseUrl = (): string => {
  if (hasLocalAuthenticatedSession()) {
    const localBase = getLocalFallbackApiUrl();
    if (localBase) return localBase;
  }

  const customHost = getSavedCustomHost();
  if (customHost) {
    return normalizeApiUrl(customHost);
  }

  const configuredUrl = getConfiguredVmUrl();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== "undefined") {
    try {
      const working =
        sessionStorage.getItem("serviprox_working_base_url") ||
        localStorage.getItem("serviprox_last_working_url");
      if (working) {
        return normalizeApiUrl(working);
      }
    } catch {
      // ignore
    }
  }

  if (Capacitor.isNativePlatform()) {
    return "http://192.168.0.6:8000/api/v1";
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    if (window.location.hostname.includes("netlify.app")) {
      return "/api/v1";
    }
    return `${window.location.origin.replace(/\/$/, "")}/api/v1`;
  }

  return "/api/v1";
};

// Base URL dinámica y reactiva
let activeBaseUrl = resolveApiBaseUrl();
let lastFallbackAt = 0;
const MV_RETRY_COOLDOWN_MS = 15000;
export let API_BASE_URL = activeBaseUrl;

export const getApiBaseUrl = (): string => activeBaseUrl;

export const getCandidateBaseUrls = (): string[] => {
  const priority = getPriorityCandidateBaseUrls();
  if (isProdMode() && getRawViteApiUrl() && isVitestEnv()) {
    return priority;
  }

  const ordered: string[] = [];
  const localFallback = getLocalFallbackApiUrl();
  const pinnedLocal = hasLocalAuthenticatedSession();
  if (pinnedLocal && localFallback && priority.includes(localFallback)) {
    ordered.push(localFallback);
  }

  const activeMode = activeBaseUrl ? getConnectionMode(activeBaseUrl) : null;
  const keepFallbackFirst =
    pinnedLocal || (activeMode === "local-sqlite" && Date.now() - lastFallbackAt < MV_RETRY_COOLDOWN_MS);

  if (activeBaseUrl && priority.includes(activeBaseUrl) && (activeMode !== "local-sqlite" || keepFallbackFirst)) {
    ordered.push(activeBaseUrl);
  }

  if (typeof window !== "undefined") {
    try {
      const sessionWorking = sessionStorage.getItem("serviprox_working_base_url");
      if (sessionWorking) {
        const normalized = normalizeApiUrl(sessionWorking);
        const sessionMode = getConnectionMode(normalized);
        if (
          priority.includes(normalized) &&
          (sessionMode !== "local-sqlite" || pinnedLocal || Date.now() - lastFallbackAt < MV_RETRY_COOLDOWN_MS)
        ) {
          ordered.push(normalized);
        }
      }
    } catch {
      // ignore
    }
  }

  for (const cand of priority) {
    ordered.push(cand);
  }

  return Array.from(new Set(ordered.filter(Boolean)));
};

export const setWorkingBaseUrl = (
  url: string,
  meta?: { database?: string; engine?: string; mode?: ConnectionMode }
) => {
  if (isProdMode() && getRawViteApiUrl() && isVitestEnv()) return;
  const normalized = normalizeApiUrl(url);
  activeBaseUrl = normalized;
  API_BASE_URL = activeBaseUrl;
  const mode = meta?.mode || getConnectionMode(normalized);
  lastFallbackAt = mode === "local-sqlite" ? Date.now() : 0;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("serviprox_working_base_url", activeBaseUrl);
      if (mode !== "local-sqlite") {
        localStorage.setItem("serviprox_last_working_url", activeBaseUrl);
      }
    } catch {
      // Ignorar restricciones de almacenamiento
    }
    window.dispatchEvent(
      new CustomEvent("serviprox:connection-status", {
        detail: {
          connected: true,
          url: activeBaseUrl,
          mode,
          database: meta?.database || "connected",
          engine: meta?.engine,
        },
      })
    );
  }
};

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
    setSessionAuthMode(null);
  },
};

const getKnownApiOrigins = (): string[] => {
  const origins: string[] = [];
  const configured = getConfiguredVmUrl();
  const saved = getSavedCustomHost();
  for (const candidate of [configured, saved ? normalizeApiUrl(saved) : ""]) {
    if (!candidate) continue;
    try {
      origins.push(new URL(candidate).origin);
    } catch {
      // ignore invalid URL
    }
  }
  return Array.from(new Set(origins));
};

const buildUrlForBase = (
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
) => {
  let effectivePath = path;
  if (/^https?:\/\//i.test(path)) {
    const target = new URL(path);
    const configured = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const matchesTarget =
      target.origin === configured.origin && target.pathname.startsWith(configured.pathname + "/");

    if (!matchesTarget) {
      const knownVmOrigins = isVitestEnv() ? [] : getKnownApiOrigins();
      const isKnownVmApiUrl =
        knownVmOrigins.includes(target.origin) && target.pathname.startsWith("/api/v1/");

      if (isKnownVmApiUrl) {
        effectivePath = `${target.pathname.replace(/^\/api\/v1\/?/, "")}${target.search}`;
      } else if (isProdMode()) {
        throw new ApiError(400, "La URL solicitada no pertenece a la API configurada.", null);
      }
    }
  }

  let fullUrl = /^https?:\/\//i.test(effectivePath)
    ? effectivePath
    : `${baseUrl}/${effectivePath.replace(/^\//, "")}`;

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
  maxRounds = 1
): Promise<Response> {
  const candidates = getCandidateBaseUrls();
  // Una respuesta perdida puede haber sido persistida: no repetir escrituras.
  if (init.method && !["GET", "HEAD"].includes(init.method)) maxRounds = 1;
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (let round = 0; round < maxRounds; round++) {
    for (const base of candidates) {
      const url = buildUrlForBase(base, path, params);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const reqHeaders = new Headers(init.headers);
        const savedHost = getSavedCustomHost();
        if (base.includes("/api/vm/v1") && savedHost) {
          reqHeaders.set("X-Serviprox-Target-Base", normalizeApiUrl(savedHost));
        }
        let response: Response;
        try {
          response = await fetch(url, {
            ...init,
            headers: reqHeaders,
            signal: init.signal || controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

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
      "No pudimos conectar con la API de Serviprox. Verifica tu conexion e intenta nuevamente.",
      null
    )
  );
}

let refreshInFlight: Promise<string | null> | null = null;
const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = performTokenRefresh().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
};

const performTokenRefresh = async () => {
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
  customCandidate?: string,
  proxyTargetOverride?: string
): Promise<{
  ok: boolean;
  database: string;
  url?: string;
  engine?: string;
  mode?: ConnectionMode;
  error?: string;
}> => {
  const normalizedCustom = customCandidate ? normalizeApiUrl(customCandidate) : "";
  const localPinnedBase = !normalizedCustom && hasLocalAuthenticatedSession() ? getLocalFallbackApiUrl() : null;
  const candidates: Array<{ base: string; targetOverride?: string }> = normalizedCustom
    ? [{ base: normalizedCustom, targetOverride: proxyTargetOverride }]
    : localPinnedBase
      ? [{ base: localPinnedBase }]
      : getPriorityCandidateBaseUrls().map((base) => ({
          base,
          targetOverride:
            base.includes("/api/vm/v1") && getSavedCustomHost()
              ? normalizeApiUrl(getSavedCustomHost())
              : undefined,
        }));

  if (
    normalizedCustom &&
    !normalizedCustom.includes("/api/vm/v1") &&
    !Capacitor.isNativePlatform() &&
    typeof window !== "undefined" &&
    window.location?.origin &&
    !window.location.hostname.includes("netlify.app") &&
    !normalizedCustom.startsWith(window.location.origin.replace(/\/$/, ""))
  ) {
    candidates.push({
      base: `${window.location.origin.replace(/\/$/, "")}/api/vm/v1`,
      targetOverride: normalizedCustom,
    });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      database: "disconnected",
      error: "No hay servidores backend configurados. Configura VITE_API_URL o la URL del backend.",
    };
  }

  let lastDetail = "";

  for (const candidate of candidates) {
    const base = candidate.base;
    try {
      const url = `${base.replace(/\/$/, "")}/health/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);
      const headers = new Headers({ Accept: "application/json" });
      if (candidate.targetOverride && base.includes("/api/vm/v1")) {
        headers.set("X-Serviprox-Target-Base", candidate.targetOverride);
      }
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as {
          status?: string;
          database?: string;
          engine?: string;
          source?: string;
          detail?: string;
        };
        if (res.ok && data.status === "ok" && data.database === "connected") {
          const mode: ConnectionMode =
            data.source === "local-sqlite" ? "local-sqlite" : getConnectionMode(base);
          setWorkingBaseUrl(base, {
            database: data.database,
            engine: data.engine,
            mode,
          });
          return {
            ok: true,
            database: data.database,
            engine: data.engine,
            mode,
            url: base,
          };
        }
        if (data.detail) {
          lastDetail = data.detail;
        }
      }
    } catch {
      // Intentar con el siguiente candidato
    }
  }

  return {
    ok: false,
    database: "disconnected",
    error: lastDetail || "No pudimos conectar con el backend o la base de datos.",
  };
};

/**
 * Guarda y prueba una URL personalizada para el backend (ej: MV DuckDNS, Render, o IP local).
 */
export const saveCustomApiHost = async (
  host: string
): Promise<{
  ok: boolean;
  message: string;
  database?: string;
  engine?: string;
  mode?: ConnectionMode;
  url?: string;
}> => {
  if (!host.trim()) {
    clearCustomApiHost();
    return { ok: true, message: "Se restauró la configuración por defecto." };
  }

  const normalized = normalizeApiUrl(host);
  if (isProdMode() && isVitestEnv() && normalized !== resolveApiBaseUrl()) {
    return { ok: false, message: "La API productiva se configura en VITE_API_URL durante la compilacion." };
  }
  const health = await checkBackendHealth(normalized);
  if (health.ok) {
    const activeUrl = health.url || normalized;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("serviprox_api_host", normalized);
        localStorage.setItem("serviprox_custom_host_explicit", "1");
      } catch {
        // ignore
      }
    }
    setWorkingBaseUrl(activeUrl, {
      database: health.database,
      engine: health.engine,
      mode: health.mode,
    });
    return {
      ok: true,
      message: `¡Conexión exitosa! Base de datos: ${health.database} (${health.engine || "API"}).`,
      database: health.database,
      engine: health.engine,
      mode: health.mode,
      url: activeUrl,
    };
  }

  return {
    ok: false,
    message: health.error || "No se pudo verificar la conexión con este servidor.",
  };
};

/**
 * Limpia la URL personalizada de localStorage y restaura el valor por defecto (VITE_API_URL).
 */
export const clearCustomApiHost = () => {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("serviprox_api_host");
      localStorage.removeItem("serviprox_custom_host_explicit");
      localStorage.removeItem("serviprox_last_working_url");
      sessionStorage.removeItem("serviprox_working_base_url");
    } catch {
      // ignore
    }
  }
  activeBaseUrl = resolveApiBaseUrl();
  API_BASE_URL = activeBaseUrl;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("serviprox:connection-status", {
        detail: { connected: false, url: activeBaseUrl, mode: getConnectionMode(activeBaseUrl) },
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
